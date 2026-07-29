import { content } from './content.js'

/**
 * The portfolio, cut into cards that can fan out of a building.
 *
 * Still derived entirely from content.js — editing your bio there updates the
 * in-world cards and the text résumé together. Titles double as animation
 * keys, so they need to stay unique within a zone.
 */
export const CARDS = {
  about: [
    { title: 'About', body: content.about.paragraphs[0] },
    { title: 'What I do', body: content.about.paragraphs[1] },
    { title: 'Skills', body: content.about.skills.join('  ·  ') },
    { title: 'Languages', body: content.about.languages.join('  ·  ') },
  ],

  work: [
    ...content.work.featured.map((project) => ({
      title: project.title,
      body: `${project.stack}\n\n${project.desc}`,
      link: project.link,
      linkLabel: project.linkLabel,
    })),
    { title: '90+ projects', body: content.work.note },
  ],

  experience: [
    ...content.experience.jobs.map((job) => ({
      title: job.role,
      body: `${job.org}\n${job.period}\n\n${job.points.join('\n')}`,
    })),
    {
      title: content.experience.education.degree,
      body: `${content.experience.education.school}\n${content.experience.education.period}`,
    },
  ],

  contact: content.contact.links.map((link) => ({
    title: link.label,
    body: link.detail,
    link: link.href,
    linkLabel: 'Open',
  })),
}

export default CARDS
