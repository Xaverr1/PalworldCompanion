import type { Element } from "../data/pals";
import { ELEMENT_ICON } from "../lib/elements";

/**
 * A pal's element type(s) rendered as the in-game element icons. Replaces the
 * old colour-coded text pills; the element name is preserved via alt/title.
 */
export function ElementBadges({ elements }: { elements: Element[] }) {
  return (
    <>
      {elements.map((el) => (
        <img
          key={el}
          className="element-icon"
          src={ELEMENT_ICON[el]}
          alt={el}
          title={el}
          loading="lazy"
        />
      ))}
    </>
  );
}
