import type { AspectKind, ChartBodyKey, NatalChart, ZodiacSign } from '../../shared/types';

export interface ReadingSection {
  id: string;
  title: string;
  targets: string[];
  education: string;
  directive: string;
}

const READING_SIGNS: Readonly<Record<ZodiacSign, string>> = {
  Aries: 'Aries is the first tropical zodiac sector. Its cardinal fire symbolism is initiative: the spark that starts a thing, sometimes before the plan has caught up.',
  Taurus: 'Taurus is a fixed earth sign. Fixed means sustaining, and earth points to practical, tangible concerns: the symbolism is patience, steadiness and sensory comfort.',
  Gemini: 'Gemini is mutable air. Mutable means adapting; air concerns ideas and exchange. Think curiosity, different perspectives and finding the words.',
  Cancer: 'Cancer is cardinal water. Water concerns feeling and attachment; cardinal means initiating. Its symbolic language centers on shelter, care and belonging.',
  Leo: 'Leo is fixed fire: sustaining a creative spark. Astrology associates it with expression, generosity and the courage to be seen.',
  Virgo: 'Virgo is mutable earth: adapting the practical details. Its traditional symbolism favors discernment, craft, maintenance and making something work a little better.',
  Libra: 'Libra is cardinal air: beginning through relationship and exchange. Its themes include balance, fairness and considering another perspective.',
  Scorpio: 'Scorpio is fixed water: sustained emotional depth. Its symbolism explores privacy, intensity, trust and what lies under the surface.',
  Sagittarius: 'Sagittarius is mutable fire: adapting through exploration and meaning. Astrology connects it with horizons, convictions and the urge to understand the bigger picture.',
  Capricorn: 'Capricorn is cardinal earth: giving practical concerns a structure and a beginning. Its themes include responsibility, ambition and building for the long term.',
  Aquarius: 'Aquarius is fixed air: sustaining ideas and principles. Its symbolic themes include communities, independent thinking and the systems people share.',
  Pisces: 'Pisces is mutable water: adaptable feeling and imagination. Its symbolism explores compassion, porous boundaries and connections that resist a neat label.',
};
const READING_HOUSES: Readonly<Record<number, string>> = {
  1: 'The first house concerns beginnings, embodiment and how a person meets a situation.',
  2: 'The second house concerns possessions, resources, livelihood and what is valued.',
  3: 'The third house concerns everyday communication, learning, siblings and the nearby environment.',
  4: 'The fourth house concerns home, roots, family foundations and private life.',
  5: 'The fifth house concerns creative play, pleasure, children and self-expression.',
  6: 'The sixth house concerns daily work, service, routines and bodily maintenance; it does not diagnose health.',
  7: 'The seventh house concerns one-to-one partnerships, agreements and the people met across the table.',
  8: 'The eighth house concerns shared resources, obligations, inheritances and encounters with change or loss.',
  9: 'The ninth house concerns extended study, beliefs, distant travel and the search for meaning.',
  10: 'The tenth house concerns public work, reputation, responsibility and visibility.',
  11: 'The eleventh house concerns friends, networks, collective projects and hopes for the future.',
  12: 'The twelfth house concerns retreat, seclusion, hidden matters and the parts of experience that need private space.',
};
const READING_ASPECTS: Readonly<Record<AspectKind, { angle: number; meaning: string }>> = {
  conjunction: { angle: 0, meaning: 'A conjunction puts two positions near the same zodiac direction. Astrology reads their themes together, as a blend whose flavor depends on the bodies involved.' },
  sextile: { angle: 60, meaning: 'A sextile is about one sixth of a circle. Traditionally it suggests an opening for cooperation, something to work with rather than a guaranteed outcome.' },
  square: { angle: 90, meaning: 'A square is a quarter-turn. Traditional astrology reads this geometry as friction or adjustment between two symbolic themes; tension can invite action.' },
  trine: { angle: 120, meaning: 'A trine is about a third of a circle. It links signs traditionally associated with the same element, so astrologers read it as ease or flow; ease is a possibility, not a promise.' },
  opposition: { angle: 180, meaning: 'An opposition is about half a circle: positions facing across the wheel. Astrology reads a polarity, two themes asking for balance or a wider perspective.' },
};
const READING_BODIES: Readonly<Record<ChartBodyKey, string>> = {
  Sun: 'The Sun is our star. In astrology its symbolism concerns vitality, identity and a sense of purpose: the central light in the story.',
  Moon: 'The Moon is Earth’s natural satellite. Astrologers associate it with rhythms, feeling, comfort and habitual responses: the inner weather, basically.',
  Mercury: 'Mercury is a physical planet, named for the messenger. Its symbolic themes are thinking, communication, learning and exchange.',
  Venus: 'Venus is a physical planet, often seen as the morning or evening star. Its symbolism concerns attraction, values, beauty and relating.',
  Mars: 'Mars is a physical planet. Its traditional heat-and-action symbolism concerns pursuit, assertion, conflict and the energy to act.',
  Jupiter: 'Jupiter is a physical planet. Traditionally called the greater benefic, its symbolism concerns growth, opportunity, generosity and meaning; excess belongs to the picture too.',
  Saturn: 'Saturn is a physical planet. Its slow visible orbit helped shape associations with time, boundaries, responsibility and the work of building something durable.',
  Uranus: 'Uranus is a physical planet discovered in the modern era. Modern astrologers associate it with disruption, experimentation and independence; those are not ancient planetary meanings.',
  Neptune: 'Neptune is a physical planet discovered in the modern era. Its modern symbolism concerns imagination, ideals, compassion and the places where boundaries become blurry.',
  Pluto: 'Pluto is a dwarf planet. Modern astrology associates it with power, deep change and what is hidden; that interpretation is symbolic, not an event forecast.',
  Chiron: 'Chiron is a small Solar System body classed as a centaur. Modern astrologers draw on the wounded-healer myth to explore vulnerability and learning; it is not a diagnosis.',
  TrueNode: 'The True Node is a calculated crossing of the Moon’s orbital path and the ecliptic, not a planet. Astrologers connect this eclipse-related geometry with direction and development.',
  Ascendant: 'The Ascendant is a calculated point: where the zodiac meets the eastern horizon at birth. Its traditional themes are beginnings, embodiment and how a person meets the world; an accurate time matters.',
  Midheaven: 'The Midheaven is the zodiac’s intersection with the upper local meridian, a calculated angle rather than a planet. It is traditionally associated with public standing and vocation, and depends on birth time and place.',
};

export function buildReadingSections(chart: NatalChart): ReadingSection[] {
  const timed = chart.input.timeIso !== null;
  const bodies = chart.bodies.filter(body => timed || (body.key !== 'Ascendant' && body.key !== 'Midheaven'));
  const sections: ReadingSection[] = [{
    id: 'orientation', title: 'Your wheel', targets: [],
    education: `Okay, first the map legend. The wheel places the calculated birth sky around twelve zodiac sectors. A body carries a symbolic theme, its sign gives that theme a style, and an aspect describes the angle between two positions. ${timed ? 'Houses divide the local sky into twelve areas that astrologers associate with areas of life.' : 'With birth time unknown, houses and horizon angles are not reliable, so we will leave those claims out. Body positions use the calculation’s time assumption; the faster-moving Moon can be uncertain too.'} The geometry is calculated; interpreting it is an astrological tradition. I'll keep those threads clear while we explore.`,
    directive: 'Introduce the main themes of the actual complete chart without replacing the component-by-component tour. General orientation has just been explained. Keep your Gen Z voice; no invitation for questions yet.',
  }];
  for (const body of bodies) {
    const targets = [body.key, body.sign, ...(timed ? [`House ${body.house}`] : [])];
    const degrees = ((body.position.longitude % 30) + 30) % 30;
    sections.push({
      id: `body-${body.key}`, title: body.key, targets,
      education: `${READING_BODIES[body.key]} ${body.sign} is a zodiac sector, not another planet or necessarily the visible constellation. ${READING_SIGNS[body.sign]} ${timed ? `A house is an area of the chart interpreted as a life setting. ${READING_HOUSES[body.house]} ` : ''}The supplied calculation places ${body.key} at ${degrees.toFixed(2)} degrees of ${body.sign}${timed ? ` in house ${body.house}` : ', with birth time unknown'}. ${body.position.speed !== undefined && body.position.speed < 0 ? 'Its supplied negative angular speed indicates retrograde: apparent backward movement in zodiac longitude from Earth’s viewpoint, not a planet reversing its actual orbit.' : ''}`,
      directive: `The general meanings of ${body.key}, ${body.sign}${timed ? ` and house ${body.house}` : ''} have just been explained. Now synthesize this actual placement for this visitor, connecting it with relevant supplied aspects and previously covered themes. Give an everyday possibility, never invented biography. Explain new concepts before relying on them. Stay with this section and do not ask what to cover next.`,
    });
  }
  if (timed) for (const cusp of chart.houses) {
    const sign = (Object.keys(READING_SIGNS) as ZodiacSign[])[Math.floor((((cusp.position.longitude % 360) + 360) % 360) / 30)]!;
    const occupants = bodies.filter(body => body.house === cusp.house).map(body => body.key);
    sections.push({
      id: `house-${cusp.house}`, title: `House ${cusp.house}`, targets: [`House ${cusp.house}`, sign],
      education: `Next, house ${cusp.house}. ${READING_HOUSES[cusp.house]} Its cusp, the boundary where this house begins, is calculated in ${sign}. ${READING_SIGNS[sign]} ${occupants.length ? `The supplied chart places ${occupants.join(', ')} here.` : 'No supplied body occupies this house. An empty house does not mean an empty life; it still has a place in the map.'}`,
      directive: `Connect the actual ${sign} cusp and ${occupants.length ? occupants.join(', ') : 'absence of supplied body occupants'} in house ${cusp.house} with the full chart. Explain the general symbolic link before personal significance. Do not invent a house ruler’s position if it is not supplied. Continue the tour.`,
    });
  }
  chart.aspects.forEach((aspect, index) => {
    if (!bodies.some(body => body.key === aspect.a) || !bodies.some(body => body.key === aspect.b)) return;
    const relation = READING_ASPECTS[aspect.kind];
    sections.push({
      id: `aspect-${index}-${aspect.a}-${aspect.kind}-${aspect.b}`,
      title: `${aspect.a} ${aspect.kind} ${aspect.b}`,
      targets: [aspect.a, aspect.b, `${aspect.a} ${aspect.kind} ${aspect.b}`],
      education: `Okay, this line joins ${aspect.a} and ${aspect.b}. ${READING_BODIES[aspect.a]} ${READING_BODIES[aspect.b]} ${relation.meaning} Here the supplied natal chart records ${aspect.a} ${aspect.kind} ${aspect.b}, with an orb of ${aspect.orb.toFixed(1)} degrees. Orb means departure from the exact ${relation.angle}-degree angle. Both endpoints belong to the birth snapshot, so this is a natal relationship, not something happening today.`,
      directive: `The general roles and geometry of ${aspect.a} ${aspect.kind} ${aspect.b} have been explained. Combine these two specific roles, their supplied signs and reliable houses into this visitor’s reading, connecting with earlier sections. Explain how the themes support, qualify or pull against each other. No invented transit dates or life events.`,
    });
  });
  sections.push({
    id: 'synthesis', title: 'Bringing the whole chart together', targets: [],
    education: "That brings us around the whole supplied wheel. Synthesis means reading the parts in relationship: a theme can be supported in one place and complicated in another. A single placement is never the whole person. We have covered the pieces; a personal reading connects them into your larger story, with room for your own experience to answer back.",
    directive: 'Conclude the comprehensive reading by synthesizing the actual whole natal chart. Explain the strongest recurring connections, tensions and qualifications across the covered components. Stay in character and keep the visitor’s agency. At the end invite their own questions; this is the end of the guided tour.',
  });
  return sections;
}

export function readingUpgrade(section: ReadingSection, index: number): string {
  const invitations = [
    `If you'd like me to connect ${section.title.toLowerCase()} with your own story, Top Up opens the personal reading. I'll keep guiding the general meanings either way.`,
    `There's a personal layer to ${section.title.toLowerCase()} that we can explore with reading access through Top Up. Next, let's keep following the wheel.`,
    `When you're ready, Top Up lets us synthesize these pieces for you. For now, you still get the explanation of ${section.title.toLowerCase()} and the rest of the map.`,
  ];
  return invitations[index % invitations.length]!;
}
