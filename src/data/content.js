export const content = {
  name: 'Md. Sakibul Hasan Rohan',
  role: 'Frontend & WordPress Developer',
  location: 'Mirpur 12, Dhaka, Bangladesh',

  /**
   * Optional headshot, served from public/. Everything that shows it degrades
   * quietly if the file isn't there, so the site never renders a broken image.
   */
  portrait: '/portrait.jpg',

  about: {
    title: "Hi, I'm Rohan 👋",
    paragraphs: [
      'Results-driven Frontend & WordPress Developer with 2+ years of experience, currently a Junior Frontend Developer at Startise Ltd. (Templately).',
      'I build fast, responsive websites with WordPress, Elementor, Gutenberg, HTML, CSS, JavaScript and Tailwind. Delivered 90+ client projects and published a plugin on WordPress.org.',
      'I also use AI-assisted development to ship faster without cutting corners on quality.',
    ],
    skills: [
      'WordPress (Elementor)',
      'HTML5',
      'CSS3',
      'JavaScript',
      'Tailwind CSS',
      'Bootstrap 5',
      'React / Next.js',
      'AI-assisted dev',
    ],
    languages: ['English', 'Bengali', 'Hindi'],
  },

  work: {
    intro: 'A couple I’m proud of — plus 90+ client sites delivered.',
    featured: [
      {
        title: 'ParkXpot — Smart Parking Marketplace',
        stack: 'Next.js · React · Tailwind · Leaflet',
        desc: 'A modern parking marketplace to discover, book and manage spaces via an interactive map. AI-assisted build.',
        link: 'https://park-xpot.vercel.app/',
        linkLabel: 'Live demo',
      },
      {
        title: 'Tukify — AI Shopping Assistant',
        stack: 'WordPress · PHP · WooCommerce · AI APIs',
        desc: 'A published WordPress.org plugin adding AI shopping assistance to WooCommerce stores.',
        link: 'https://wordpress.org/plugins/tukify/',
        linkLabel: 'View plugin',
      },
    ],
    note: 'Also delivered: E-commerce, blogs, LMS, service sites & theme customization.',
  },

  experience: {
    jobs: [
      {
        role: 'Jr. Frontend Developer',
        org: 'Startise Ltd. (Templately)',
        period: 'Jan 2026 — Present',
        points: [
          'Build responsive templates with WordPress, Elementor & Gutenberg.',
          'Convert Figma designs into pixel-perfect, reusable templates.',
        ],
      },
      {
        role: 'WordPress Developer',
        org: 'SM Technology',
        period: 'Oct 2024 — Nov 2025',
        points: [
          'Built custom WordPress sites with Elementor Pro.',
          'Integrated SEO, speed, forms & e-commerce plugins.',
        ],
      },
      {
        role: 'Intern — WordPress Developer',
        org: 'bdCalling Academy',
        period: 'Jul 2024 — Oct 2024',
        points: [
          'Hands-on training in Elementor, theme customization & plugins.',
          'Built real-world projects under expert guidance.',
        ],
      },
    ],
    education: {
      degree: 'Diploma in Computer Science & Technology',
      school: 'Kushtia Polytechnic Institute',
      period: '2020 — 2024',
    },
  },

  contact: {
    intro: 'Open to freelance work and collaborations. Reach me at:',
    links: [
      { label: 'Email', detail: 'sh.rohan.personal@gmail.com', href: 'mailto:sh.rohan.personal@gmail.com' },
      { label: 'Phone', detail: '+880 1747-582013', href: 'tel:+8801747582013' },
      { label: 'WordPress.org', detail: 'Tukify plugin', href: 'https://wordpress.org/plugins/tukify/' },
      { label: 'GitHub', detail: 'sh03rohan', href: 'https://github.com/sh03rohan' },
      {
        label: 'LinkedIn',
        detail: 'md-sakibul-hasan-rohan',
        href: 'https://www.linkedin.com/in/md-sakibul-hasan-rohan/',
      },
    ],
  },
}

export default content
