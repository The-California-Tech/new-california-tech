export interface TechConfig {
  banner: {
    src: string;
    alt: string;
  };
  volume: string;
  location: string;
  /**
   * The editors' address. The single source for it: the masthead, the Contact
   * links, /submit's notices, and where submission notifications go and
   * replies to confirmations come back.
   */
  email: string;
}

export const techConfig: TechConfig = {
  banner: {
    src: '/tech.svg',
    alt: 'The California Tech',
  },
  volume: 'Vol. CXXIX',
  location: 'Pasadena, CA',
  email: 'tech@caltech.edu',
};
