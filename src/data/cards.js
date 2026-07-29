import { content as c } from './content.js'

/**
 * The portfolio, cut into cards that fan out of a building.
 *
 * Each card names the layout it wants:
 *   A — glass panel with an accent rail. The general case.
 *   B — timeline entry: period badge, role, org, bulleted points.
 *   D — editorial split header. Used for the one education entry.
 *
 * Still derived entirely from content.js, so editing your bio there updates
 * the in-world cards and the text résumé together.
 */
export const CARDS = {
  about: [
    {
      variant: 'A',
      accent: '#ffc98a',
      title: 'About',
      meta: c.about.title,
      body: c.about.paragraphs[0],
    },
    {
      variant: 'A',
      accent: '#ffc98a',
      title: 'Skills',
      meta: 'What I work with',
      body: c.about.skills.join('  ·  '),
    },
    {
      variant: 'A',
      accent: '#ffc98a',
      title: 'Languages',
      body: c.about.languages.join('  ·  '),
    },
  ],

  work: [
    ...c.work.featured.map((p) => ({
      variant: 'A',
      accent: '#ffd27a',
      title: p.title,
      meta: p.stack,
      period: 'Featured project',
      body: p.desc,
      link: p.link,
      linkLabel: p.linkLabel,
    })),
    {
      variant: 'A',
      accent: '#ffd27a',
      title: '90+ projects delivered',
      body: c.work.note,
    },
  ],

  experience: [
    ...c.experience.jobs.map((j) => ({
      variant: 'B',
      accent: '#9bd0ff',
      role: j.role,
      period: j.period,
      org: j.org,
      points: j.points,
    })),
    {
      variant: 'D',
      accent: '#ffc98a',
      eyebrow: 'Education',
      title: c.experience.education.degree,
      org: c.experience.education.school,
      period: c.experience.education.period,
      body: 'Foundation in computer science & software development — the groundwork behind 90+ delivered projects.',
    },
  ],

  contact: c.contact.links.map((l) => ({
    variant: 'A',
    accent: '#ec8a76',
    title: l.label,
    body: l.detail,
    link: l.href,
    linkLabel: 'Open',
  })),
}

export default CARDS
