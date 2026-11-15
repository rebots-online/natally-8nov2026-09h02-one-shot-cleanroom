import type { AspectKind, ChartBodyKey, NatalChart, ZodiacSign } from '../../shared/types';

export interface ReadingSection {
  id: string;
  title: string;
  targets: string[];
  education: string;
  directive: string;
}

const READING_SIGN_ORDER: readonly ZodiacSign[] = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];
const READING_SIGNS: Readonly<Record<ZodiacSign, string>> = {
  Aries: 'Aries opens the tropical zodiac. Cardinal fire is the spark that starts a thing, sometimes before the plan has caught up. Very first-tab-already-open energy.',
  Taurus: 'Taurus is fixed earth: sustaining something practical and tangible. Its symbolism is patience, steadiness and sensory comfort. A little texture, a little staying power.',
  Gemini: 'Gemini is mutable air: adapting through ideas and exchange. Think curiosity, different perspectives and finding the words. One thought has already invited three friends.',
  Cancer: 'Cancer is cardinal water: beginning from feeling and attachment. Shelter, care and belonging are its symbolic language. The question is what makes a place feel like home.',
  Leo: 'Leo is fixed fire: keeping a creative spark alive. Astrology connects it with expression, generosity and the courage to be seen. Let the light have a little room.',
  Virgo: 'Virgo is mutable earth: adapting the practical details. Discernment, craft and maintenance belong here. Low-key, making something work a little better is its own art.',
  Libra: 'Libra is cardinal air: beginning through relationship and exchange. Balance, fairness and another perspective enter the conversation. There is more than one seat at this table.',
  Scorpio: 'Scorpio is fixed water: sustained emotional depth. Its symbolism explores privacy, intensity, trust and what lies under the surface. The quiet bit can have a whole ocean underneath.',
  Sagittarius: 'Sagittarius is mutable fire: adapting through exploration and meaning. Astrology connects it with horizons, convictions and the bigger picture. Okay, but what is over that hill?',
  Capricorn: 'Capricorn is cardinal earth: giving practical concerns a structure and a beginning. Responsibility, ambition and building for the long term are the themes. It is giving foundations before the rooftop garden.',
  Aquarius: 'Aquarius is fixed air: sustaining ideas and principles. Communities, independent thinking and shared systems belong to its symbolism. How could the whole arrangement work differently?',
  Pisces: 'Pisces is mutable water: adaptable feeling and imagination. Its symbolism explores compassion, porous boundaries and connections that resist a neat label. Some pictures really do need watercolor.',
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
  Sun: 'Okay, the Sun: our actual star, and the central light in this story. In astrology we read it through vitality, identity and a sense of purpose.',
  Moon: 'The Moon is Earth’s natural satellite. In astrology it brings rhythms, feeling, comfort and habitual responses into the picture. The inner weather, basically.',
  Mercury: 'Mercury is a real planet, named for the messenger. Its symbolic territory is thinking, communication, learning and exchange. Thoughts finding their way into words.',
  Venus: 'Venus is a real planet, the bright morning or evening star. Attraction, values, beauty and relating are its symbolic themes. What draws us closer, and what feels worth cherishing.',
  Mars: 'Mars is a real planet. Its traditional heat-and-action symbolism is about pursuit, assertion, conflict and the energy to act. The spark that gets a thing moving.',
  Jupiter: 'Jupiter is a real planet, traditionally called the greater benefic. We read growth, opportunity, generosity and meaning here. Also excess, because more is a whole mood and occasionally too much of one.',
  Saturn: 'Saturn is a real planet with a slow visible orbit. That helped shape its associations with time, boundaries, responsibility and building something durable. The long game has entered the chat.',
  Uranus: 'Uranus is a real planet discovered in the modern era. Modern astrologers link it with disruption, experimentation and independence. We cannot give ancient astrologers credit for these particular meanings.',
  Neptune: 'Neptune is a real planet discovered in the modern era. Its modern symbolism explores imagination, ideals, compassion and blurry boundaries. The picture starts to look a little like a daydream.',
  Pluto: 'Pluto is a dwarf planet. Modern astrology reads power, deep change and hidden things through it. That is a symbolic lens, not a forecast that some dramatic event is about to land.',
  Chiron: 'Chiron is a small Solar System body called a centaur. Modern astrologers borrow the wounded-healer myth to explore vulnerability and learning. A story to think with, not a diagnosis of anyone.',
  TrueNode: 'The True Node is geometry, bestie: a calculated crossing of the Moon’s orbital path and the ecliptic, rather than a planet. It matters to eclipses, and astrologers connect it symbolically with direction and development.',
  Ascendant: 'The Ascendant is a calculated point where the zodiac meets the eastern horizon at birth. Beginnings, embodiment and meeting the world are its traditional themes. This little doorway really does need an accurate birth time.',
  Midheaven: 'The Midheaven is another calculated angle, where the zodiac crosses the upper local meridian. Think the sky’s north-to-south reference line above the horizon. Traditionally we look here for public standing and vocation, and birth time and place matter.',
};

export function buildReadingSections(chart: NatalChart): ReadingSection[] {
  const timed = chart.input.timeIso !== null;
  const bodies = chart.bodies.filter(body => timed || (body.key !== 'Ascendant' && body.key !== 'Midheaven'));
  const sections: ReadingSection[] = [{
    id: 'orientation', title: 'Your wheel', targets: [],
    education: `Okay, first the map legend, so I don't just hand you a wheel full of mysterious squiggles. Your calculated birth sky sits around twelve zodiac sectors. A body carries a symbolic theme, its sign gives that theme a style, and an aspect is the angle between two positions. The four elements are symbolic families: fire for energy and expression, earth for practical tangible things, air for ideas and exchange, and water for feeling and connection. Modality means how a sign approaches change: cardinal starts, fixed sustains, and mutable adapts. Those are the words I'll be using, with the translation included. ${timed ? 'Houses divide the local sky into twelve areas that astrologers connect with areas of life.' : "Without a reliable birth time, I can't trust the houses or horizon angles. We'll leave those out. The body positions use an assumed time for the calculation, so the faster-moving Moon can be uncertain too."} The geometry is calculated; reading meaning into it is our astrological tradition. I'll keep those threads clear as we go.`,
    directive: 'Introduce the main themes of the actual complete chart without replacing the component-by-component tour. General orientation has just been explained. Keep your Gen Z voice; no invitation for questions yet.',
  }];
  for (const body of bodies) {
    const targets = [body.key, body.sign, ...(timed ? [`House ${body.house}`] : [])];
    const degrees = ((body.position.longitude % 30) + 30) % 30;
    sections.push({
      id: `body-${body.key}`, title: body.key, targets,
      education: `${READING_BODIES[body.key]} Now let me bring ${body.sign} into focus. That is a zodiac sector, not a second planet or necessarily the visible constellation. ${READING_SIGNS[body.sign]} ${timed ? `And the house gives the theme a life setting. ${READING_HOUSES[body.house]} ` : ''}Here in your calculated chart, ${body.key} is at ${degrees.toFixed(2)} degrees of ${body.sign}${timed ? ` in house ${body.house}` : ', with birth time unknown'}. ${body.position.speed !== undefined && body.position.speed < 0 ? "One more little detail: its calculated angular speed is negative, which means retrograde. It appears to move backward in zodiac longitude from Earth’s viewpoint; the actual planet hasn't decided to reverse its orbit." : ''}`,
      directive: `The general meanings of ${body.key}, ${body.sign}${timed ? ` and house ${body.house}` : ''} have just been explained. Now synthesize this actual placement for this visitor, connecting it with relevant supplied aspects and previously covered themes. Give an everyday possibility, never invented biography. Explain new concepts before relying on them. Stay with this section and do not ask what to cover next.`,
    });
  }
  if (timed) for (const cusp of chart.houses) {
    const sign = READING_SIGN_ORDER[Math.floor((((cusp.position.longitude % 360) + 360) % 360) / 30)]!;
    const occupants = bodies.filter(body => body.house === cusp.house).map(body => body.key);
    sections.push({
      id: `house-${cusp.house}`, title: `House ${cusp.house}`, targets: [`House ${cusp.house}`, sign],
      education: `Come with me to house ${cusp.house} for a moment. ${READING_HOUSES[cusp.house]} Its cusp is simply the boundary where the house begins, and this chart puts it in ${sign}. ${READING_SIGNS[sign]} ${occupants.length ? `Your calculated chart places ${occupants.join(', ')} here. We'll hold those themes alongside this life setting.` : "None of the bodies in this chart occupies this house. But empty house does not mean empty life, okay? The room still belongs to the map."}`,
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
      education: `Okay, follow this little line with me: it joins ${aspect.a} and ${aspect.b}. A quick reminder of our two characters. ${READING_BODIES[aspect.a]} ${READING_BODIES[aspect.b]} ${relation.meaning} Your calculated chart has ${aspect.a} ${aspect.kind} ${aspect.b}, with an orb of ${aspect.orb.toFixed(1)} degrees. Orb is just how far the angle is from exactly ${relation.angle} degrees. Both ends are in the birth snapshot, so we're exploring a natal relationship here, rather than announcing something happening today.`,
      directive: `The general roles and geometry of ${aspect.a} ${aspect.kind} ${aspect.b} have been explained. Combine these two specific roles, their supplied signs and reliable houses into this visitor’s reading, connecting with earlier sections. Explain how the themes support, qualify or pull against each other. No invented transit dates or life events.`,
    });
  });
  sections.push({
    id: 'synthesis', title: 'Bringing the whole chart together', targets: [],
    education: "Okay, we've come all the way around your calculated wheel. This is the part I love: bringing the pieces together. Synthesis means reading them in relationship, because a theme can be supported in one place and complicated in another. One placement never gets to declare itself the whole person. We have met the pieces; a personal reading connects them into a larger story, with room for your own experience to answer back.",
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
