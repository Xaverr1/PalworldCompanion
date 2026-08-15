// Targeted GVAS reader for Palworld saves: walks to CharacterSaveParameterMap
// and pulls only the fields we need per pal, skipping everything else by size.
// Ported from palworld-save-tools (archive.py / gvas.py / rawdata/character.py)
// and validated byte-identical against it on a real save.
import type { SavePal } from "./saveImport";

const utf16 = new TextDecoder("utf-16le");
const ascii = new TextDecoder("ascii");

class Reader {
  private b: Uint8Array;
  private v: DataView;
  p = 0;

  constructor(bytes: Uint8Array) {
    this.b = bytes;
    this.v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  eof() {
    return this.p >= this.b.length;
  }
  skip(n: number) {
    this.p += n;
  }
  read(n: number): Uint8Array {
    const s = this.b.subarray(this.p, this.p + n);
    this.p += n;
    return s;
  }
  u16() {
    const x = this.v.getUint16(this.p, true);
    this.p += 2;
    return x;
  }
  i32() {
    const x = this.v.getInt32(this.p, true);
    this.p += 4;
    return x;
  }
  u32() {
    const x = this.v.getUint32(this.p, true);
    this.p += 4;
    return x;
  }
  u64() {
    const x = this.v.getBigUint64(this.p, true);
    this.p += 8;
    return Number(x); // property/array sizes are small
  }
  byte() {
    return this.b[this.p++];
  }
  optionalGuid() {
    if (this.byte() !== 0) this.skip(16);
  }
  fstring(): string {
    const len = this.i32();
    if (len === 0) return "";
    if (len < 0) {
      const n = -len;
      const bytes = this.read(n * 2);
      return utf16.decode(bytes.subarray(0, n * 2 - 2));
    }
    const bytes = this.read(len);
    return ascii.decode(bytes.subarray(0, len - 1));
  }
}

type Handler = (name: string, type: string, size: number) => boolean;

/** Read a property type's preamble, then skip its `size`-counted value region. */
function skipBody(r: Reader, type: string, size: number) {
  switch (type) {
    case "BoolProperty":
      r.byte();
      r.optionalGuid();
      return;
    case "StructProperty":
      r.fstring(); // struct_type
      r.skip(16); // struct_id
      r.optionalGuid();
      break;
    case "ArrayProperty":
      r.fstring(); // array_type
      r.optionalGuid();
      break;
    case "MapProperty":
      r.fstring(); // key_type
      r.fstring(); // value_type
      r.optionalGuid();
      break;
    case "EnumProperty":
    case "ByteProperty":
      r.fstring(); // enum_type
      r.optionalGuid();
      break;
    default: // Int/UInt16/UInt32/Int64/FixedPoint64/Float/Str/Name/...
      r.optionalGuid();
  }
  r.skip(size);
}

function readByte(r: Reader): number | string {
  const enumType = r.fstring();
  r.optionalGuid();
  return enumType === "None" ? r.byte() : r.fstring();
}
function readStr(r: Reader): string {
  r.optionalGuid();
  return r.fstring();
}
function readName(r: Reader): string {
  r.optionalGuid();
  return r.fstring();
}
function readEnum(r: Reader): string {
  r.fstring(); // enum_type
  r.optionalGuid();
  return r.fstring();
}
function readNameEnumArray(r: Reader): string[] {
  r.fstring(); // array_type (EnumProperty | NameProperty)
  r.optionalGuid();
  const count = r.u32();
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(r.fstring());
  return out;
}
function readByteArray(r: Reader): Uint8Array {
  r.fstring(); // array_type == ByteProperty
  r.optionalGuid();
  const count = r.u32();
  return r.read(count);
}

/** Iterate a property set until "None"; `handle` returns true if it consumed the value. */
function eachProperty(r: Reader, handle: Handler) {
  for (;;) {
    const name = r.fstring();
    if (name === "None") return;
    const type = r.fstring();
    const size = r.u64();
    if (!handle(name, type, size)) skipBody(r, type, size);
  }
}

const last = (s: number | string): number | string =>
  typeof s === "string" ? (s.split("::").pop() as string) : s;

interface ParsedPal extends SavePal {
  isPlayer: boolean;
}

function readSaveParameter(r: Reader): ParsedPal {
  const out: ParsedPal = {
    code: "",
    level: 1,
    rank: 1,
    gender: undefined,
    ivs: { hp: 0, shot: 0, defense: 0 },
    abilities: [],
    passives: [],
    isPlayer: false,
  };
  eachProperty(r, (name, type) => {
    switch (name) {
      case "CharacterID":
        out.code = readName(r);
        return true;
      case "Level":
        out.level = Number(readByte(r)) || 1;
        return true;
      case "Rank":
        out.rank = Number(readByte(r)) || 1;
        return true;
      case "Gender":
        out.gender = String(last(readEnum(r)));
        return true;
      case "NickName":
        out.nickname = readStr(r);
        return true;
      case "Talent_HP":
        out.ivs!.hp = Number(readByte(r)) || 0;
        return true;
      case "Talent_Shot":
        out.ivs!.shot = Number(readByte(r)) || 0;
        return true;
      case "Talent_Defense":
        out.ivs!.defense = Number(readByte(r)) || 0;
        return true;
      case "EquipWaza":
        out.abilities = readNameEnumArray(r).map((w) => String(last(w)));
        return true;
      case "PassiveSkillList":
        out.passives = readNameEnumArray(r);
        return true;
      case "IsPlayer":
        if (type === "BoolProperty") {
          out.isPlayer = r.byte() !== 0;
          r.optionalGuid();
          return true;
        }
        return false;
      default:
        return false;
    }
  });
  return out;
}

/** Decode one character's RawData byte blob into its fields, or null. */
function decodeCharacter(bytes: Uint8Array): ParsedPal | null {
  const r = new Reader(bytes);
  const held: { sp: ParsedPal | null } = { sp: null };
  eachProperty(r, (name, type) => {
    if (name === "SaveParameter" && type === "StructProperty") {
      r.fstring(); // struct_type
      r.skip(16); // struct_id
      r.optionalGuid();
      held.sp = readSaveParameter(r);
      return true;
    }
    return false;
  });
  return held.sp && held.sp.code ? held.sp : null;
}

function skipGvasHeader(r: Reader) {
  if (r.i32() !== 0x53415647) throw new Error("Not a GVAS save (bad magic).");
  r.i32(); // save_game_version
  r.i32(); // ue4
  r.i32(); // ue5
  r.u16();
  r.u16();
  r.u16(); // engine major/minor/patch
  r.u32(); // changelist
  r.fstring(); // branch
  r.i32(); // custom_version_format
  const cvCount = r.u32();
  r.skip(cvCount * 20); // each: guid(16) + i32(4)
  r.fstring(); // save_game_class_name
}

/** Extract every captured pal from a decompressed GVAS save blob. */
export function extractPals(gvasBytes: Uint8Array): {
  pals: SavePal[];
  players: number;
} {
  const r = new Reader(gvasBytes);
  skipGvasHeader(r);
  const pals: SavePal[] = [];
  let players = 0;

  eachProperty(r, (name, type) => {
    if (name !== "worldSaveData" || type !== "StructProperty") return false;
    r.fstring();
    r.skip(16);
    r.optionalGuid(); // struct preamble
    eachProperty(r, (n2, t2) => {
      if (n2 !== "CharacterSaveParameterMap" || t2 !== "MapProperty") return false;
      r.fstring();
      r.fstring();
      r.optionalGuid(); // key_type, value_type, id
      r.u32(); // pad
      const count = r.u32();
      for (let i = 0; i < count; i++) {
        eachProperty(r, () => false); // key set (PlayerUId / InstanceId / ...)
        const held: { blob: Uint8Array | null } = { blob: null };
        eachProperty(r, (vn, vt) => {
          if (vn === "RawData" && vt === "ArrayProperty") {
            held.blob = readByteArray(r);
            return true;
          }
          return false;
        });
        if (!held.blob) continue;
        const p = decodeCharacter(held.blob);
        if (!p) continue;
        if (p.isPlayer) {
          players++;
        } else {
          pals.push({
            code: p.code,
            level: p.level,
            rank: p.rank,
            gender: p.gender,
            nickname: p.nickname,
            ivs: p.ivs,
            abilities: p.abilities,
            passives: p.passives,
          });
        }
      }
      return true;
    });
    return true;
  });

  return { pals, players };
}
