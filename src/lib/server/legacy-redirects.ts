/**
 * Where each article URL from the old Hugo site (tech.caltech.edu before
 * October 2026) lives now. Generated once, from the URL-by-URL review of the
 * old site against this one, and edited by hand from here on.
 *
 * Keys are old paths as normalizeLegacyPath() leaves them: decoded, lowercase,
 * no trailing slash. Values are this site's paths: an article (`/slug`), or a
 * print issue's PDF (`/issues/<date>.pdf`) for pieces that were only kept in
 * print.
 *
 * A value is a slug at the time of the import, not a link to the article. If
 * an article's Website Slug is changed in Notion, change its line here too.
 * Old paths that are the same on this site (/about, /write...) are not listed;
 * they would redirect to themselves.
 */
export const LEGACY_REDIRECTS: Readonly<Record<string, string>> = {
  '/2023/03/2023-04-04-making-the-case-for-the-orange-crewmate': '/making-the-case-for-the-orange-crewmate',
  '/2023/03/2023-04-05-march-art-spotlight': '/march-art-spotlight',
  '/2023/03/chat-meri-makhmuryan': '/chat-meri-makhmuryan',
  '/2023/03/fizz-comes-to-campus': '/fizz-comes-to-campus',
  '/2023/03/growing-student-body-leads-undergraduate-housing-shortage':
    '/growing-student-body-leads-undergraduate-housing-shortage',
  '/2023/03/kenny-pay': '/kenny-pay',
  '/2023/03/mannion-recipes': '/mannion-recipes',
  '/2023/03/question-quail-1': '/question-quail-1',
  '/2023/03/reinstate-it-cannot-wait': '/reinstate-it-cannot-wait',
  '/2023/03/the-crc-is-back': '/the-crc-is-back',
  '/2023/03/title-ix-interview': '/title-ix-interview',
  '/2023/03/winter-term-interhouse-spotlight': '/winter-term-interhouse-spotlight',
  '/2023/04/2023-04-05-ascit-winter-election-results': '/ascit-winter-election-results',
  '/2023/04/2023-04-05-banana-99': '/banana-99',
  '/2023/04/2023-04-05-caltech-theater--mach-33-presents-the-sunrise-from-the-moon': '/issues/2023-04-11.pdf',
  '/2023/04/2023-04-05-investigation-into-crimes-against-the-california-tech':
    '/investigation-into-crimes-against-the-california-tech',
  '/2023/04/2023-04-05-the-critter-corner-analysis-of-the-ipad-kid-species':
    '/the-critter-corner-analysis-of-the-ipad-kid-species',
  '/2023/04/2023-04-05-the-hot-rivet-puzzles-section': '/the-hot-rivet-puzzles-section',
  '/2023/04/2023-04-05-who-will-sonic-end-up-with-in-the-next-movie': '/who-will-sonic-end-up-with-in-the-next-movie',
  '/2023/04/2023-04-11-puzzles': '/puzzles',
  '/2023/04/2023-04-11-rolling': '/rolling',
  '/2023/04/2023-04-11-spotlight-sean-cutting-accessibility-services-specialist':
    '/spotlight-sean-cutting-accessibility-services-specialist',
  '/2023/04/2023-04-11-this-week-in-the-houses': '/this-week-in-the-houses',
  '/2023/04/2023-04-25-2023-ascit-formal': '/2023-ascit-formal',
  '/2023/04/2023-04-25-caltech-dining-scoop---new-red-door-items': '/caltech-dining-scoop-new-red-door-items',
  '/2023/04/2023-04-25-core-and-covid-caltech-hosts-biannual-student-faculty-conference':
    '/core-and-covid-caltech-hosts-biannual-student-faculty-conference',
  '/2023/04/2023-04-27-whats-with-the-turtles': '/whats-with-the-turtles',
  '/2023/04/april-art-spotlight': '/issues/2023-04-04.pdf',
  '/2023/04/art-spotlight-april-24-2023': '/issues/2023-04-24.pdf',
  '/2023/04/ascit-board-directors-meeting-minutes-april-9-2023': '/ascit-board-directors-meeting-minutes-april-9-2023',
  '/2023/04/ascit-bylaw-amendments': '/ascit-bylaw-amendments',
  '/2023/04/bod-meeting-minutes-april-16-2023': '/bod-meeting-minutes-april-16-2023',
  '/2023/04/candidate-statements-ascit-spring-2023-elections': '/candidate-statements-ascit-spring-2023-elections',
  '/2023/04/dabney-lies-dangerous-crossroads': '/dabney-lies-dangerous-crossroads',
  '/2023/04/fizz-asserts-control': '/fizz-asserts-control',
  '/2023/04/gift-shops': '/gift-shops',
  '/2023/04/hawaii': '/hawaii',
  '/2023/04/hot-water': '/hot-water',
  '/2023/04/ihc-meeting-minutes-april-9-2023': '/ihc-meeting-minutes-april-9-2023',
  '/2023/04/imaging-the-beginning-of-time': '/imaging-the-beginning-of-time',
  '/2023/04/legacy-moore-law': '/legacy-moore-law',
  '/2023/04/lettre-de-rupture': '/lettre-de-rupture',
  '/2023/04/magic-australia': '/magic-australia',
  '/2023/04/multicultural-fashion-show-april-29th': '/multicultural-fashion-show-april-29th',
  '/2023/04/power-hum': '/power-hum',
  '/2023/04/question-the-quail-april-24-2023': '/question-the-quail-april-24-2023',
  '/2023/04/red-door-tree': '/red-door-tree',
  '/2023/04/springtime-campus-photography-feature': '/springtime-campus-photography-feature',
  '/2023/04/student-faculty-conference': '/student-faculty-conference',
  '/2023/04/super-mario-bros': '/super-mario-bros',
  '/2023/04/transcript-admissions-tour-leaked': '/transcript-admissions-tour-leaked',
  '/2023/04/yam-controversy': '/yam-controversy',
  '/2023/05/art-and-photography-spotlight-may-16-2023': '/issues/2023-05-16.pdf',
  '/2023/05/ascits-hot-new-bod': '/ascits-hot-new-bod',
  '/2023/05/caltech-alpine-club-visits-red-rock-canyon': '/caltech-alpine-club-visits-red-rock-canyon',
  '/2023/05/caltech-dining-scoop-i-would-berry-much-like-some-fruit':
    '/caltech-dining-scoop-i-would-berry-much-like-some-fruit',
  '/2023/05/discotech-a-reflection': '/discotech-a-reflection',
  '/2023/05/ditch-day-was-indeed-tomorrow': '/ditch-day-was-indeed-tomorrow',
  '/2023/05/esprit-de-corps--be-a-beaver': '/esprit-de-corps-be-a-beaver',
  '/2023/05/first-republic-bank-sale-student-loses-2400': '/first-republic-bank-sale-student-loses-2400',
  '/2023/05/high-yield-rate-for-co-2027-leaves-students-with-no-housing':
    '/high-yield-rate-for-co-2027-leaves-students-with-no-housing',
  '/2023/05/interview-with-a-bike-thief': '/interview-with-a-bike-thief',
  '/2023/05/kenny-got-paid': '/kenny-got-paid',
  '/2023/05/new-undergraduate-dean-appointed': '/new-undergraduate-dean-appointed',
  '/2023/05/outsiders-insider-caltech-from-the-perspective-of-an-exchange-student':
    '/outsiders-insider-caltech-from-the-perspective-of-an-exchange-student',
  '/2023/05/proposed-solutions-to-the-housing-crisis': '/proposed-solutions-to-the-housing-crisis',
  '/2023/05/question-the-quail': '/question-the-quail',
  '/2023/05/question-the-quail-3': '/question-the-quail-3',
  '/2023/05/review-arturos-taco-truck': '/review-arturos-taco-truck',
  '/2023/05/so-we-have-a-beaver-statue-now': '/so-we-have-a-beaver-statue-now',
  '/2023/05/spring-interhouvse-spotlight': '/spring-interhouvse-spotlight',
  '/2023/05/the-admin-corner---lesley-nye': '/the-admin-corner-lesley-nye',
  '/2023/05/the-california-tech-crossword': '/the-california-tech-crossword',
  '/2023/05/two-years-two-bikes': '/two-years-two-bikes',
  '/2023/05/update-on-bernoulli-the-beaver': '/update-on-bernoulli-the-beaver',
  '/2023/05/why-caltechs-mandatory-meal-plans-need-to-change': '/why-caltechs-mandatory-meal-plans-need-to-change',
  '/2023/05/world-fest-2023': '/world-fest-2023',
  '/2023/06/2023-sfp-summer-ambassador-cohort': '/2023-sfp-summer-ambassador-cohort',
  '/2023/06/2023-undergraduate-student-awards': '/2023-undergraduate-student-awards',
  '/2023/06/a-column-from-the-foodcomm-chair': '/a-column-from-the-foodcomm-chair',
  '/2023/06/admin-corner-felicia-hunt': '/admin-corner-felicia-hunt',
  '/2023/06/amazon-skymall---june-13-2023': '/issues/2023-06-13.pdf',
  '/2023/06/art-and-photography-spotlight-may-31-2023': '/issues/2023-05-31.pdf',
  '/2023/06/art-and-photography-spotlight-pride-month': '/issues/2023-06-13.pdf',
  '/2023/06/blacker-hovse-takes-over-the-sierras': '/blacker-hovse-takes-over-the-sierras',
  '/2023/06/caltech-dining-scoop-plant-yourself-at-the-farmers-market':
    '/caltech-dining-scoop-plant-yourself-at-the-farmers-market',
  '/2023/06/caltech-timely-warning-crime-bulletin-aggravated-assault':
    '/caltech-timely-warning-crime-bulletin-aggravated-assault',
  '/2023/06/chatgpt-vs-the-honor-code': '/chatgpt-vs-the-honor-code',
  '/2023/06/choosing-caltech-a-frosh-retrospective': '/choosing-caltech-a-frosh-retrospective',
  '/2023/06/club-spotlight-aero-association-of-caltech': '/club-spotlight-aero-association-of-caltech',
  '/2023/06/editorial-fizz-continues-to-assert-control': '/editorial-fizz-continues-to-assert-control',
  '/2023/06/is-the-housing-crisis-really-a-crisis': '/is-the-housing-crisis-really-a-crisis',
  '/2023/06/letter-to-the-editor-bread': '/letter-to-the-editor-bread',
  '/2023/06/magic-eye-illusion-or-delusion': '/magic-eye-illusion-or-delusion',
  '/2023/06/make-a-difference-day': '/make-a-difference-day-2023-06-13',
  '/2023/06/minecraft-120-update-review': '/minecraft-120-update-review',
  '/2023/06/my-frosh-year-2022-23-a-reflection': '/my-frosh-year-2022-23-a-reflection',
  '/2023/06/query-the-quails-june-13-2023': '/query-the-quails-june-13-2023',
  '/2023/06/rock-and-roll-broken-glass-pane-at-red-door-briefly-causes-chaos':
    '/rock-and-roll-broken-glass-pane-at-red-door-briefly-causes-chaos',
  '/2023/06/surviving-a-year-in-marks-house': '/surviving-a-year-in-marks-house',
  '/2023/06/the-california-tech-crossword': '/the-california-tech-crossword-2023-05-16',
  '/2023/06/uc-berkeley-phd-student-gabriel-trujillo-killed-in-sonora-mexico-during-research-trip':
    '/uc-berkeley-phd-student-gabriel-trujillo-killed-in-sonora-mexico-during-research-trip',
  '/2023/06/writers-strike': '/writers-strike',
  '/2023/09/a-chat-with-beth-larranaga': '/a-chat-with-beth-larranaga',
  '/2023/09/caltech-dining-scoop-early-bird-gets-the-cds-breakfast':
    '/caltech-dining-scoop-early-bird-gets-the-cds-breakfast',
  '/2023/09/censorship-and-squirrels': '/censorship-and-squirrels',
  '/2023/09/crossword-and-amazon-skymall---september-19th': '/the-california-tech-crossword-heavy-metal',
  '/2023/09/dear-orange-column': '/dear-orange-column',
  '/2023/09/financial-analysis-and-implications-of-ascits-budgetary-trends-and-dues-increase':
    '/financial-analysis-and-implications-of-ascits-budgetary-trends-and-dues-increase',
  '/2023/09/lets-talk-about-the-title-ix-situation': '/lets-talk-about-the-title-ix-situation',
  '/2023/09/local-news-beat': '/local-news-beat',
  '/2023/09/movie-review-my-big-fat-greek-wedding-3-fun-at-best-nonsense-at-worst':
    '/movie-review-my-big-fat-greek-wedding-3-fun-at-best-nonsense-at-worst',
  '/2023/09/profile-michele-judd': '/profile-michele-judd',
  '/2023/09/question-the-quail-6': '/question-the-quail-6',
  '/2023/09/spectres-famous-anakin-found-in-flumpster-estimated-100-in-damages-':
    '/spectres-famous-anakin-found-in-flumpster-estimated-100-in-damages',
  '/2023/09/the-turtle-club-photography-contest': '/the-turtle-club-photography-contest',
  '/2023/09/what-to-do-with-the-tech-after-youve-read-it': '/issues/2023-09-19.pdf',
  '/2023/10/17/apartment-building': '/apartment-building',
  '/2023/10/17/art-photos-comics-oct-17': '/issues/2023-10-17.pdf',
  '/2023/10/17/ascit-social-calendar-2023-24': '/ascit-social-calendar-2023-24',
  '/2023/10/17/bechtel-room-codes': '/bechtel-room-codes',
  '/2023/10/17/divorce-drinks-and-long-drives-the-mountain-goats-experience':
    '/divorce-drinks-and-long-drives-the-mountain-goats-experience',
  '/2023/10/17/hss-course-offerings-an-analysis-of-the-past-five-years':
    '/hss-course-offerings-an-analysis-of-the-past-five-years',
  '/2023/10/17/local-happenings-in-pasadena': '/local-happenings-in-pasadena-2023-10-17',
  '/2023/10/17/mens-soccer-and-mens-water-polo-start-the-weekend-strong':
    '/mens-soccer-and-mens-water-polo-start-the-weekend-strong',
  '/2023/10/17/new-changes-in-caltech-athletics-and-recreation-to-fix-old-problems':
    '/new-changes-in-caltech-athletics-and-recreation-to-fix-old-problems',
  '/2023/10/17/question-the-quail': '/question-the-quail-2023-10-17',
  '/2023/10/17/the-calai-odyssey': '/the-calai-odyssey',
  '/2023/10/17/the-unstandardization-of-caltech-bathrooms': '/the-unstandardization-of-caltech-bathrooms',
  '/2023/10/17/to-unionize-or-not-to-unionize': '/to-unionize-or-not-to-unionize',
  '/2023/10/31/caltech-cross-country-finishes-third-and-fifth-at-sciacs-meet':
    '/caltech-cross-country-finishes-third-and-fifth-at-sciacs-meet',
  '/2023/10/31/caltech-unionization-effort': '/caltech-unionization-effort',
  '/2023/10/31/cgpu-op-ed': '/cgpu-op-ed',
  '/2023/10/31/diving-deep-into-a-caltech-althletes-life': '/diving-deep-into-a-caltech-althletes-life',
  '/2023/10/31/gsc-email-list-policies': '/gsc-email-list-policies',
  '/2023/10/31/interhouse-sports-in-full-swing-with-the-conclusion-of-interhouse-dodgeball':
    '/interhouse-sports-in-full-swing-with-the-conclusion-of-interhouse-dodgeball',
  '/2023/10/31/local-happenings-in-pasadena': '/local-happenings-in-pasadena-2023-10-31',
  '/2023/10/31/quail-halloween': '/quail-halloween',
  '/2023/10/31/rotation-review': '/rotation-review',
  '/2023/10/31/women-and-men-soccer-end-their-seasons-strong': '/women-and-men-soccer-end-their-seasons-strong',
  '/2023/10/barbies-aka-feminism-101': '/barbies-aka-feminism-101',
  '/2023/10/blackers-potato-cannon-banned-after-over-20-years-of-use':
    '/blackers-potato-cannon-banned-after-over-20-years-of-use',
  '/2023/10/caltech-adventures-cowtech': '/issues/2023-10-03.pdf',
  '/2023/10/caltech-mens-soccer-rising-to-the-top': '/caltech-mens-soccer-rising-to-the-top',
  '/2023/10/caltech-y-annual-yosemite-hike-an-odyssey': '/caltech-y-annual-yosemite-hike-an-odyssey',
  '/2023/10/cgpu-holds-new-year-new-union-majority-rally': '/cgpu-holds-new-year-new-union-majority-rally',
  '/2023/10/the-frosh-perspective--blacker-olympics': '/the-frosh-perspective-blacker-olympics',
  '/2023/10/the-truth-about-not-eating-when-youre-hungry': '/the-truth-about-not-eating-when-youre-hungry',
  '/2023/10/today-on-how-badly-can-i-represent-this-data': '/today-on-how-badly-can-i-represent-this-data',
  '/2023/10/when-tradition-awakens-trauma-the-fleming-cannons-unintended-consequences':
    '/when-tradition-awakens-trauma-the-fleming-cannons-unintended-consequences',
  '/2023/11/14/caltech-course-on-biomechanics-of-organismal-design':
    '/caltech-course-on-biomechanics-of-organismal-design',
  '/2023/11/14/caltech-meditation-mob-begins-its-10th-year': '/caltech-meditation-mob-begins-its-10th-year',
  '/2023/11/14/caltech-orange-needs-a-hint-of-green': '/caltech-orange-needs-a-hint-of-green',
  '/2023/11/14/housing-painting-over-murals': '/housing-painting-over-murals',
  '/2023/11/14/local-happenings-in-pasadena': '/local-happenings-in-pasadena-2023-11-14',
  '/2023/11/14/question-the-quail': '/question-the-quail-2023-11-14',
  '/2023/11/14/the-warped-side-of-our-universe': '/the-warped-side-of-our-universe',
  '/2023/11/14/what-does-it-mean-to-be-original': '/what-does-it-mean-to-be-original',
  '/2023/11/28/behind-the-numbers': '/behind-the-numbers',
  '/2023/11/28/caltech-eliminates': '/caltech-eliminates',
  '/2023/11/28/caltech-up-close-2023': '/caltech-up-close-2023',
  '/2023/11/28/fnaf-movie': '/fnaf-movie',
  '/2023/11/28/house-ethics-commitee': '/house-ethics-commitee',
  '/2023/11/28/movie-review': '/movie-review',
  '/2023/11/28/new-couches': '/new-couches',
  '/2023/11/28/pasadena-new-column': '/pasadena-new-column',
  '/2023/11/28/question-the-quail': '/question-the-quail-2023-11-28',
  '/2023/11/28/sports-ball': '/sports-ball',
  '/2023/11/28/the-honor-code-is-falling-apart': '/the-honor-code-is-falling-apart',
  '/2023/11/28/unleash-your-inner-prankster': '/unleash-your-inner-prankster',
  '/2023/11/28/vice-president-of-student-affairs': '/vice-president-of-student-affairs',
  '/2023/11/28/write-for-the-tech': '/write-for-the-tech',
  '/2024/01/16/best-of-tqfrs': '/best-of-tqfrs',
  '/2024/01/16/caltech-graduates-students': '/caltech-graduates-students',
  '/2024/01/16/chemist-pageant-lady': '/chemist-pageant-lady',
  '/2024/01/16/dear-orange': '/dear-orange',
  '/2024/01/16/feel-free-to-cancel-me-its-ok': '/feel-free-to-cancel-me-its-ok',
  '/2024/01/16/free-as-in-speech-not-laundry': '/free-as-in-speech-not-laundry',
  '/2024/01/16/hidden-camera-title-ix-case': '/hidden-camera-title-ix-case',
  '/2024/01/16/latinx-pronouns-language': '/latinx-pronouns-language',
  '/2024/01/16/meet-the-red-door-baristas': '/meet-the-red-door-baristas',
  '/2024/01/16/pants-fire-frosh-evicted': '/pants-fire-frosh-evicted',
  '/2024/02/06/caltech-core-problem': '/caltech-core-problem',
  '/2024/02/06/if-this-is-to-end-in-fire': '/if-this-is-to-end-in-fire',
  '/2024/02/06/local-happenings-in-pasadena': '/local-happenings-in-pasadena-2024-02-06',
  '/2024/02/06/lunar-new-year': '/lunar-new-year',
  '/2024/02/06/man-vs-mannion': '/man-vs-mannion',
  '/2024/02/06/meet-the-humans-of-red-door': '/meet-the-humans-of-red-door',
  '/2024/02/06/page-house-mural-sage-continues': '/page-house-mural-sage-continues',
  '/2024/02/06/president-provost-vpsa-convene-faculty': '/president-provost-vpsa-convene-faculty',
  '/2024/02/06/question-the-quails': '/question-the-quails',
  '/2024/02/06/reflection-on-student-leadership': '/reflection-on-student-leadership',
  '/2024/02/06/sinister-six-thirsty': '/sinister-six-thirsty',
  '/2024/02/06/title-ix-case-delays-are-not-isolated-occurences': '/title-ix-case-delays-are-not-isolated-occurences',
  '/2024/02/27/ascit-winter-election': '/ascit-winter-election',
  '/2024/02/27/athletic-donations': '/athletic-donations',
  '/2024/02/27/faculty-petition-speaks-to-broader': '/faculty-petition-speaks-to-broader',
  '/2024/02/27/letter-to-editor': '/issues/2024-02-27.pdf',
  '/2024/02/27/movie-review': '/movie-review-2024-02-27',
  '/2024/02/27/rain-secrets-from-brit': '/rain-secrets-from-brit',
  '/2024/02/27/the-roots-of-pbu-at-caltech': '/the-roots-of-pbu-at-caltech',
  '/2024/02/27/theater-review': '/theater-review',
  '/2024/02/27/titlet-ix-poll-results': '/titlet-ix-poll-results',
  '/2024/02/27/union-vote': '/union-vote',
  '/2024/03/12/asbestos': '/asbestos',
  '/2024/03/12/august-guild-debut': '/august-guild-debut',
  '/2024/03/12/caltechs-path-to-decarbonization': '/caltechs-path-to-decarbonization',
  '/2024/03/12/class-of-2028-releases': '/class-of-2028-releases',
  '/2024/03/12/decarbonization': '/issues/2024-03-12.pdf',
  '/2024/03/12/leaks-reveal': '/leaks-reveal',
  '/2024/03/12/state-of-city': '/state-of-city',
  '/2024/03/12/the-march-experience': '/the-march-experience',
  '/2024/03/12/when-will-show-end': '/when-will-show-end',
  '/2024/04/12/caltech-astronomy-mexico-eclipse':
    '/caltech-astronomy-outreach-visits-piedras-negras-mexico-for-april-8-solar-eclipse',
  '/2024/04/12/did-the-pandemic-kill-caltech-culture': '/did-the-pandemic-kill-caltech-culture',
  '/2024/04/12/financial-aid-lawsuit-continues':
    '/financial-aid-lawsuit-against-caltech-and-other-top-universities-continues',
  '/2024/04/12/inner-sustainability-god': '/unearthing-your-inner-sustainability-god',
  '/2024/04/12/jpl-strong-february-layoffs': '/jpl-community-remains-strong-in-wake-of-february-layoffs',
  '/2024/04/12/mit-prank': '/the-california-techs-mit-prank',
  '/2024/04/12/new-roompicks-ihc-announcement': '/ihc-announcement-new-roompicks-procedures',
  '/2024/04/12/nightmare-my-title-ix-experience': '/a-nightmare-that-never-ends-my-title-ix-experience',
  '/2024/04/12/shopping-cart-test': '/caltech-undergraduates-miserably-fail-shopping-cart-test',
  '/2024/04/12/turtle-club-mascot-announcement': '/turtle-club-mascot-announcement',
  '/2024/04/12/tv-review-the-regime': '/tv-review-the-regime',
  '/2024/04/26/ascit-spring-candidate-statements': '/ascit-spring-candidate-statements',
  '/2024/04/26/cafe-reviews': '/review-of-cafes-around-campus',
  '/2024/04/26/caltech-quiz-bowl': '/caltech-trivia-team-returns-to-national-tournament-after-14-year-hiatus',
  '/2024/04/26/commencement-is-expensive': '/commencement-is-expensive',
  '/2024/04/26/crossword-science-showdown': '/crossword-science-showdown',
  '/2024/04/26/happy-election-day': '/happy-election-day',
  '/2024/04/26/housing-lottery': '/the-article-about-the-housing-lottery',
  '/2024/04/26/letter-sat-reinstatement':
    '/you-can-and-should-do-better-faculty-members-a-commentary-on-the-reinstated-satact-requirement-for-undergraduate-admissions',
  '/2024/04/26/movie-review-civil-war': '/movie-review-civil-war',
  '/2024/04/26/north-houses-survive': '/north-houses-survive-encounter-with-the-smell',
  '/2024/04/26/palestine-rally': '/palestine-rally',
  '/2024/04/26/palestine-sit-in': '/caltech-students-hold-peaceful-sit-in-for-palestine',
  '/2024/04/26/ranked-pairs-voting': '/on-ranked-pairs-voting',
  '/2024/04/26/songs-to-get-murdered-to': '/songs-to-get-murdered-to',
  '/2024/04/26/title-ix-coordinator-resigns': '/title-ix-coordinator-resigns',
  '/2024/05/17/art-and-photo-spotlight': '/issues/2024-05-17.pdf',
  '/2024/05/17/avery-greenhouse': '/avery-greenhouse',
  '/2024/05/17/blinterhouse': '/blacker-hosts-gravity-falls-themed-interhovse-party',
  '/2024/05/17/caltech-protests-for-palestine': '/caltech-protests-for-palestine',
  '/2024/05/17/editorial-faculty-petition': '/editorial-note-on-the-faculty-petition',
  '/2024/05/17/free-speech-changes': '/changes-to-caltechs-free-speech-and-expression-policy-explained',
  '/2024/05/17/letter-ose': '/come-on-ose-isnt-the-bad-guy',
  '/2024/05/17/life-with-brain-implant':
    '/life-with-a-brain-implant-interview-with-clinical-trial-subject-james-johnson',
  '/2024/05/17/miniature-train': '/have-you-ever-wanted-to-ride-a-miniature-train-here-is-your-chance',
  '/2024/05/17/musical-audition': '/issues/2024-05-17.pdf',
  '/2024/05/17/new-ihc-and-ascit': '/new-ihc-committee-chairs-and-ascit-bod-for-2024-25',
  '/2024/05/17/off-campus-joys': '/the-joys-of-living-off-campus',
  '/2024/05/17/quantum-hype': '/quantum-hype-and-the-end-of-half-decent-writing-in-media',
  '/2024/05/17/risk-review-gracie-abrams': '/risk-single-review-gracie-abrams-is-back',
  '/2024/05/17/sat-act-article-response':
    '/we-have-and-are-trying-to-do-better-a-response-and-update-to-the-satact-article',
  '/2024/05/17/songs-for-arcade': '/songs-for-arcade',
  '/2024/05/17/student-affairs-reorganization': '/student-affairs-division-reorganized-new-dean-of-student-experience',
  '/2024/05/17/tech-sponsored-workout': '/the-california-tech-sponsored-workout',
  '/2024/05/sitting-down-with-mellow-dram': '/sitting-down-with-mellow-drama',
  '/2024/05/sources-confirm-ditch-day-imminent': '/sources-confirm-ditch-day-imminent',
  '/2024/06/04/ascit-voting-mandatory': '/voting-in-ascit-elections-should-be-mandatory-an-argument',
  '/2024/06/04/athletics-in-admissions-caltech': '/athletics-in-admissions-at-caltech-a-look-at-some-numbers',
  '/2024/06/04/beautiful-unrealistic-solutions': '/beautiful-unrealistic-solutions-lessons-in-chemistry-review',
  '/2024/06/04/decision-making-for-standardized-tests':
    '/the-decision-making-process-for-reinstating-standardized-testing-in-admissions',
  '/2024/06/04/eas-cultural-facelift': '/eas-cultural-facelift-introducing-the-graduate-student-advisory-board',
  '/2024/06/04/goals-for-better-workplace':
    '/graduate-student-and-postdoc-workers-share-goals-for-a-better-workplace-as-bargaining-begins',
  '/2024/06/04/hss-professor-reinstatement-petition': '/hss-professor-reinstatement-petition',
  '/2024/06/04/huntington-homage-to-nature': '/the-huntingtons-new-homage-to-nature',
  '/2024/06/04/people-of-red-door': '/meet-the-people-of-red-door-deveon-howard',
  '/2024/06/04/profile-joe-kirschvink': '/a-profile-on-professor-joe-kirschvink',
  '/2024/06/04/sjp-who-provides-the-fuel':
    '/we-are-the-engine-of-research-at-caltech-but-who-is-providing-the-fuel-and-who-is-driving',
  '/2024/06/04/songs-to-char-a-marshmallow-to': '/songs-to-char-a-marshmallow-to',
  '/2024/06/04/staging-earth-data': '/staging-earth-data-in-tacits-earth-data-the-musical',
  '/2024/06/04/techxercises': '/the-california-tech-sponsored-workout',
  '/2024/06/04/the-year-that-was': '/this-is-the-year-that-was-or-was-it',
  '/2024/06/04/who-is-the-tech': '/who-is-the-tech-and-what-do-we-stand-for',
  '/2024/06/statements/statements': '/statements',
  '/2024/09/24/a-perspective-on-writing-motherhood-and-teaching-at-caltech':
    '/edan-lepucki-a-perspective-on-writing-motherhood-and-teaching-at-caltech',
  '/2024/09/24/climate-change': '/new-exhibition-at-the-huntington-examines-the-environment-through-a-historical-lens',
  '/2024/09/24/club-spotlight-caltech-rugby-club': '/club-spotlight-caltech-rugby-club',
  '/2024/09/24/end-of-summer': '/the-end-of-the-summer',
  '/2024/09/24/guiding-the-world-caltech-with-laura-flower':
    '/guiding-the-worlds-students-through-caltech-with-laura-flower-kim',
  '/2024/09/24/in-pasadena-a-new-way-of-flipping-burgers': '/in-pasadena-a-new-way-of-flipping-burgers',
  '/2024/09/24/lamentation-of-a-sandwich': '/lamentation-of-a-sandwich',
  '/2024/09/24/man-vs-mannionman-edition': '/man-vs-mannion-2024-09-24',
  '/2024/09/24/man-vs-mannionmannion-edition': '/man-vs-mannion-2024-09-24',
  '/2024/09/24/mental-health-at-caltech': '/mental-health-at-caltech',
  '/2024/09/24/slec-announcement': '/slec-announcement',
  '/2024/09/24/song-to-survice-heatwave': '/songs-to-survive-a-heatwave-to',
  '/2024/10/08/academic-year-welcome': '/deans-corner-academic-year-welcome',
  '/2024/10/08/big-microwave': '/microwaves-in-modern-society',
  '/2024/10/08/kiss-affiliates': '/kiss-affiliates',
  '/2024/10/08/leaky-sprinkler-scourge': '/we-are-not-immune-to-the-scourge-of-leaky-sprinklers',
  '/2024/10/08/mailbox-alert': '/mailbox-alert',
  '/2024/10/08/man-vs-mannion-man': '/man-vs-mannion-2024-10-08',
  '/2024/10/08/man-vs-mannion-mannion': '/man-vs-mannion-2024-10-08',
  '/2024/10/08/outsourced-online-camp-backlash':
    '/caltech-faces-backlash-for-outsourced-online-bootcamps-community-reacts',
  '/2024/10/08/pasadena-happenings': '/local-happenings-in-pasadena',
  '/2024/10/08/sandwich-lamentation': '/lamentation-of-a-sandwich',
  '/2024/10/08/side-quests-galore': '/pf-pf-hooray-side-quests-galore',
  '/2024/10/08/slec-sfc-signups': '/slec-sfc-signups',
  '/2024/10/08/ug-admissions-athletics': '/why-the-weight-of-athletics-was-reduced-for-undergraduate-admissions',
  '/2024/10/08/very-warm-welcome': '/a-very-warm-welcome-to-caltech',
  '/2024/10/08/virtualitics-ai-research':
    '/caltech-spinoff-virtualitics-gives-back-with-dollar100000-pledge-for-ai-research',
  '/2024/10/08/womens-soccer-highlight': '/womens-soccer-highlight-september-28',
  '/2024/10/22/blended-worlds-jpl': '/blended-worlds-art-x-jpl',
  '/2024/10/22/caltech-hall-pond': '/caltech-hall-pond-bridge-art-or-annoyance',
  '/2024/10/22/the-growing-legacy-of-caltech-trees':
    '/the-growing-legacy-of-caltechs-trees-a-technological-and-sustainable-environmental-revolution',
  '/2024/11/athletics-admissions-recap': '/athletics-in-admissions-open-office-hours-recap',
  '/2024/11/caltech-2024-milestones': '/caltech-in-2024-a-year-of-milestones-achievements-and-new-frontiers',
  '/2024/11/caltech-y-hosts': '/caltech-y-hosts-community-service-and-advocacy-fair',
  '/2024/11/crossing-over-exhibit': '/crossing-over-an-arts-and-sciences-fusion-at-caltech',
  '/2024/11/deans-corner-athletics': '/deans-corner-on-athletics',
  '/2024/11/e-plegona':
    '/e-plegona-red-door-cafes-interactive-art-installation-brings-yamahas-vision-of-kando-to-caltech',
  '/2024/11/earth-like-exoplanet': '/can-we-detect-an-earth-like-exoplanet-orbiting-a-sun-like-star-for-signs-of-life',
  '/2024/11/hand-drill-hannibal': '/hand-drill-hannibal-strikes-again',
  '/2024/11/man-vs-mannion-casa-bianca': '/man-vs-mannion-casa-bianca-pizza-pie-review',
  '/2024/11/new-security-cameras':
    '/new-security-cameras-to-be-installed-at-undergraduate-residence-entrances-this-fall-live-starting-january',
  '/2024/11/non-mid-things': '/a-list-of-not-so-mid-things-we-enjoy',
  '/2024/11/other-mascot-history': '/history-of-the-other-mascot',
  '/2024/11/quail-returns': '/return-of-question-the-quail',
  '/2024/11/swim-dive-win': '/caltech-swim-and-dive-wins-first-dual-meet',
  '/2024/11/tesla-radio-stage': '/engineering-tesla-a-futurist-radio-on-stage',
  '/2024/11/tim-ryan-interview': '/an-interview-with-tim-ryan',
  '/2024/12/03/ascit-board-of-directors-propose': '/ascit-board-of-directors-propose-new-bylaws-amendments',
  '/2024/12/03/ballads-of-east-and-west': '/ballads-of-east-and-west-at-the-huntington',
  '/2024/12/03/caltech-isnt-for-everyone': '/caltech-isnt-for-everyone',
  '/2024/12/03/caltech-ranks': '/caltech-ranks-111th-in-2025-fire-free-speech-college-rankings',
  '/2024/12/03/chase-report': '/where-is-the-chase-report',
  '/2024/12/03/i-know-i_dont-know': '/i-know-i-dont-know',
  '/2024/12/03/interview-with-stuart-weitzman': '/an-interview-with-stuart-weitzman',
  '/2024/12/03/jpl-faces-november-layoffs': '/jpl-faces-november-layoffs-third-round-this-year',
  '/2024/12/03/local-holiday-event-pasadena': '/local-holiday-events-in-pasadena',
  '/2024/12/03/man-vs-mannion': '/man-vs-mannion-hk-macau-bistro',
  '/2024/12/03/meet-dr-saeromi-kim': '/meet-dr-saeromi-kim-the-new-director-of-counseling-services-at-sws',
  '/2024/12/03/question-the-quail': '/question-the-quail-december-3-2024',
  '/2024/12/03/regarding-the-a-in-steam': '/regarding-the-a-in-steam',
  '/2024/12/03/sleeping-again': '/sleeping-again',
  '/2024/12/03/this-moment-in-time': '/this-moment-in-time-a-celebration-of-ephemerality',
  '/2024/12/bomb-threat-on-campus-near-south-undergraduate-houses':
    '/bomb-threat-on-campus-near-south-undergraduate-houses',
  '/2025/01/14/a-study-of-caltech-lunch-hour-chaos': '/brownian-motion-a-study-of-caltechs-lunch-hour-chaos',
  '/2025/01/14/ai-in-caltech-2025': '/ai-at-caltech-in-2025-hows-it-going-has-it-destroyed-everything',
  '/2025/01/14/behind-foreign-glasses': '/behind-foreign-glasses',
  '/2025/01/14/caltech-and-la-wildfires': '/caltech-and-la-wildfires',
  '/2025/01/14/circumnavigating-tacit-earth-data': '/circumnavigating-tacits-earth-data-the-musical-a-retrospective',
  '/2025/01/14/colonizing-the-best-in-ourselves': '/as-below-so-above-colonizing-the-best-in-ourselves',
  '/2025/01/14/eaton-fire-scorches-the-caltech-and-pasadena-community':
    '/eaton-fire-scorches-the-caltech-and-pasadena-community',
  '/2025/01/14/let-it-snow': '/let-it-snow-let-it-shine-let-it-rain',
  '/2025/01/14/the-metaphysical-ideas-of-plato': '/the-metaphysical-ideas-of-plato-reality-or-imagination',
  '/2025/01/14/what-up-with-switch-up-2': '/whats-up-with-the-switch-2',
  '/2025/01/28/aristotle': '/aristotle-the-philosopher-of-reason-reality-and-the-tangible-world',
  '/2025/01/28/athletics-director-stepping-down': '/betsy-mitchell-to-step-down-as-athletic-director',
  '/2025/01/28/cgpu-bargaining-statement':
    '/cgpu-bargaining-team-statement-in-support-of-our-groundbreaking-tentative-agreement',
  '/2025/01/28/cgpu-misleads-compensation': '/cgpu-misleads-in-compensation-gains-of-proposed-tentative-agreement',
  '/2025/01/28/huntington-exhibit': '/rare-17th-century-portrait-comes-to-pasadena',
  '/2025/01/28/switch-2': '/what-games-will-be-on-the-switch-2',
  '/2025/01/28/the-bubble': '/the-bubble',
  '/2025/01/28/wasted-time-at-bechtel':
    '/the-case-for-more-card-readers-how-bechtels-single-entrance-costs-students-1454-hours-yearly',
  '/2025/01/28/wicked-caltech-off-campus': '/from-wicked-to-wickedly-fun-caltechs-off-campus-adventures',
  '/2025/02/18/-the-british-schindler': '/the-british-schindler',
  '/2025/02/18/an-interview-with-sandy-krasner-fighting-climate-change':
    '/an-interview-with-sandy-krasner-fighting-climate-change',
  '/2025/02/18/caltech-wildlife-coyotes-on-campus': '/caltech-wildlife-coyotes-on-campus',
  '/2025/02/18/deepseek': '/deepseek',
  '/2025/02/18/department-of-education-warning':
    '/us-department-of-education-warns-universities-over-equity-programs-threatens-federal-funding',
  '/2025/02/18/diy-punk-metal-emo-shows-and-where-to-find-them': '/diypunkmetalemo-shows-and-where-to-find-them',
  '/2025/02/18/everything-flows': '/everything-flows-everything-moves-and-nothing-ever-stops-heraclitus-and-panta-rei',
  '/2025/02/18/jenijoy-la-belle-a-trailblazer-in-academia-a-champion-of-literature-and-a-legacy-that-lives-on':
    '/jenijoy-la-belle-a-trailblazer-in-academia-and-a-champion-of-literature',
  '/2025/02/18/new-honor-code-approved-updates': '/new-approved-honor-code-updates',
  '/2025/02/18/practicing-resilience-at-a-downsized-jpl': '/practicing-resilience-at-a-downsized-jpl',
  '/2025/02/18/the-history-of-underrepresented-students-at-caltech-a-journey-of-struggle-and-progress':
    '/the-history-of-underrepresented-students-at-caltech-a-journey-of-struggle-and-progress',
  '/2025/02/18/the-layoff-of-dr-tim-parker-a-message-from-an-ex-jpler':
    '/the-layoff-of-dr-tim-parker-an-open-letter-to-jpl',
  '/2025/02/18/vote-on-updates-to-the-ascit-amendments': '/vote-on-updates-to-the-ascit-amendments',
  '/2025/03/04/caltech-federal-funding-cuts': '/caltech-faces-uncertainty-pending-federal-funding-cuts',
  '/2025/03/04/caltech-nih-lawsuit': '/caltech-joins-lawsuit-suing-nih-over-funding-cuts',
  '/2025/03/04/caltech-woodpeckers': '/caltech-wildlife-acorn-woodpeckers',
  '/2025/03/04/democritus-the-atomic-visionary': '/democritus-the-atomic-visionary-whispering-through-caltechs-labs',
  '/2025/03/04/frank-capra-caltech-oscars-filmmaker': '/frank-capra-caltech-oscars-filmmaker',
  '/2025/03/04/jack-parsons-revolutionized-rocketry':
    '/jack-parsons-the-paradoxical-figure-who-revolutionized-rocketry',
  '/2025/03/04/parallel-lives': '/parallel-lives',
  '/2025/03/04/research-emfs-wildfires': '/recent-research-sheds-light-on-the-relationship-between-emfs-and-wildfires',
  '/2025/04/08/a-retrospective-of-a-hollywood-portrait-legend': '/a-retrospective-of-a-hollywood-portrait-legend',
  '/2025/04/08/accessing-buildings-after-hours': '/accessing-buildings-after-hours',
  '/2025/04/08/applications-open-for-2025-wolfram-summer-school': '/applications-open-for-2025-wolfram-summer-school',
  '/2025/04/08/ascit-2025-spring-elections-candidate-statements': '/ascit-2025-spring-elections-candidate-statements',
  '/2025/04/08/caltech-must-protect-its-students': '/caltech-must-protect-its-students',
  '/2025/04/08/caltech-rugby-club-saves-graduate-formal': '/caltech-rugby-club-saves-graduate-formal',
  '/2025/04/08/caltech-students-eligible-for-2025-student-academy-awards':
    '/caltech-students-eligible-for-2025-student-academy-awardsr',
  '/2025/04/08/caltech-wildlife-the-migrators': '/caltech-wildlife-the-migrators',
  '/2025/04/08/epicurus-at-caltech-the-garden-of-serenity-and-science':
    '/epicurus-at-caltech-the-garden-of-serenity-and-science',
  '/2025/04/08/off-campus-report': '/off-campus-report-surf-at-mit-and-study-abroad-at-the-university-of-edinburgh',
  '/2025/04/08/on-timeless-wisdom-ninthcentury-japanese-culture-embedded-in-dabney-garden':
    '/on-timeless-wisdom-ninth-century-japanese-culture-embedded-in-dabney-garden',
  '/2025/04/08/the-underrated-and-underexplored-world-of-south-indian-cuisine':
    '/the-underrated-and-underexplored-world-of-south-indian-cuisine',
  '/2025/04/08/tuberculosis-is-the-world-deadliest-disease': '/tuberculosis-is-the-worlds-deadliest-disease',
  '/2025/04/08/wolf-prize-2025': '/caltech-faculty-named-laureates-of-the-wolf-prize',
  '/2025/04/22/caltech-doe-lawsuit': '/caltech-joins-federal-lawsuit-over-doe-grant-funding-cuts',
  '/2025/04/22/caltech-president-retirement': '/caltech-president-thomas-rosenbaum-announces-retirement',
  '/2025/04/22/caltech-wildlife-bird-immigrants': '/caltech-wildlife-bird-immigrants',
  '/2025/04/22/courses-that-dont-suck': '/courses-that-dont-suck',
  '/2025/04/22/dream-lab': '/my-dream-lab-how-ai-transformed-my-self-analysis',
  '/2025/04/22/dropbox': '/dropbox',
  '/2025/04/22/im-still-here': '/im-still-here',
  '/2025/04/22/iyq-2025': '/iyq-2025-caltechs-role-in-100-years-of-quantum-mechanics',
  '/2025/04/22/letter-to-coach': '/letter-to-my-coach',
  '/2025/04/22/nintendo-direct-rankings': '/every-game-shown-in-the-march-nintendo-direct-and-how-excited-i-am',
  '/2025/04/22/philosophy-eleatic-school': '/the-three-pillars-of-the-eleatic-school',
  '/2025/04/22/the-day-i-died': '/the-day-i-died',
  '/2025/04/22/ts-pmo-places-you-shouldnt-be': '/ts-pmo-places-you-shouldnt-be',
  '/2025/04/22/volunteering-for-change': '/volunteering-for-change',
  '/2025/05/13/caltech-and-usc-rally-downtown-kill-the-cuts': '/caltech-and-usc-rally-downtown-to-kill-the-cuts',
  '/2025/05/13/caltech-athletics-bloom-in-spring-season': '/caltech-athletics-bloom-in-spring-season',
  '/2025/05/13/caltech-wildlife-fox-squirrels': '/caltech-wildlife-fox-squirrels',
  '/2025/05/13/cinco-de-mayo-at-browne-dining-hall': '/cinco-de-mayo-fiesta-lights-up-browne-dining-hall',
  '/2025/05/13/how-peru-changed-me-a-bridge-between-two-worlds': '/how-peru-changed-me-a-bridge-between-two-worlds',
  '/2025/05/13/make-a-difference-at-yaanna-lila-rodriguez-aceves-brings-land-based-learning-to-caltech':
    '/make-a-difference-at-yaanna-lila-rodriguez-aceves-brings-land-based-learning-to-caltech',
  '/2025/05/13/more-funding-cuts-and-uncertainty-at-nsf': '/more-funding-cuts-and-uncertainty-at-nsf',
  '/2025/05/13/nasa-faces-budget-cut-heres-how-you-can-fight-back':
    '/nasa-faces-47percent-budget-cutheres-how-you-can-fight-back',
  '/2025/05/13/student-shop-announcement': '/student-shop-announcement',
  '/2025/05/13/the-obligation-to-worklife-balance': '/the-obligation-to-work-life-balance',
  '/2025/05/13/unions-like-uaw-must-shift-their-focus-to-defend-americas-scientific-future':
    '/unions-like-uaw-must-shift-their-focus-to-defend-americas-scientific-future',
  '/2025/05/13/vive-la-fete-a-revolutionary-blacker-interhouse': '/vive-la-fete-a-revolutionary-blacker-interhouse',
  '/2025/05/13/what-cuts-kill-on-wonder-and-revolution': '/what-cuts-kill-on-wonder-and-revolution',
  '/2025/05/13/what-if--the-disney-influence': '/what-if-the-disney-influence-in-my-and-probably-everyones-life',
  '/2025/05/13/what-is-love': '/what-is-love',
  '/2025/05/13/what-you-will-and-what-a-delight-explicts-twelfth-night':
    '/what-you-will-and-what-a-delight-explicits-twelfth-night',
  '/2025/06/03/a-senior-prank-of-cosmic-proportions-kip-thorne-s-85th-birthday-bash':
    '/a-senior-prank-of-cosmic-proportions-kip-thornes-85th-birthday-bash',
  '/2025/06/03/artificial-intelligence-our-modern-promethean-fire':
    '/artificial-intelligence-our-modern-promethean-fire',
  '/2025/06/03/ascit-bod-meeting-minutes-may-25th-2025': '/ascit-bod-meeting-minutes-may-25th-2025',
  '/2025/06/03/caltech-wildlife-juveniles': '/caltech-wildlife-juvenile-panel-interviews',
  '/2025/06/03/finding-faith-and-family-far-from-home-my-journey-with-ask-ministries':
    '/finding-faith-and-family-far-from-home-my-journey-with-ask-ministries',
  '/2025/06/03/giving-the-planet-a-break-with-dr-daniel-lewis': '/giving-the-planet-a-break-with-dr-daniel-lewis',
  '/2025/06/03/hic-et-nunc-presence-under-pressure-at-caltech': '/hic-et-nunc-presence-under-pressure-at-caltech',
  '/2025/06/03/how-benson-boone-saved-my-college-life': '/how-benson-boone-saved-my-college-life',
  '/2025/06/03/i-have-failed': '/i-have-failed',
  '/2025/06/03/is-that-all-there-is-a-letter-from-the-editor': '/is-that-all-there-is-a-letter-from-the-editor',
  '/2025/06/03/music-in-a-temple-of-science': '/music-in-a-temple-of-science',
  '/2025/06/03/path-optimization-on-campus': '/path-optimization-on-campus',
  '/2025/06/03/reminiscences-of-caltech-rugby': '/reminiscences-of-caltech-rugby',
  '/2025/06/03/robots-and-remembrance-transcending-memory-with-dementia-doula':
    '/robots-and-remembrance-transcending-memory-with-dementia-doula',
  '/2025/06/03/science-in-the-vatican': '/science-in-the-vatican',
  '/2025/06/03/silk-installation-at-the-huntington-reflects-on-a-world-without-us':
    '/silk-installation-at-the-huntington-reflects-on-a-world-without-us',
  '/2025/06/03/stars-solutions-and-service-a-sass-lunch-with-dr-lorraine-lundquist':
    '/stars-solutions-and-service-a-sass-lunch-with-dr-lorraine-lundquist',
  '/2025/06/03/symphony': '/symphony',
  '/2025/09/23/read-the-little-t': '/read-the-little-t',
  '/2025/09/23/what-journalism-means-here-a-letter-from-the-editor':
    '/what-journalism-means-here-a-letter-from-the-editor',
  '/2025/10/07/2025-pasadena-coffee-report': '/2025-pasadena-coffee-report',
  '/2025/10/07/a-concert-filled-socal-summer': '/a-concert-filled-socal-summer',
  '/2025/10/07/an-ode-to-the-red-door-quesadilla': '/an-ode-to-the-red-door-quesadilla',
  '/2025/10/07/caltech-welcomes-international-students-amid-immigration-uncertainties':
    '/caltech-welcomes-international-students-amid-immigration-uncertainties',
  '/2025/10/07/caltech-wildlife-a-welcome-guide': '/caltech-wildlife-a-welcome-guide',
  '/2025/10/07/david-baltimore-former-caltech-president-dies-at-87':
    '/david-baltimore-former-caltech-president-dies-at-87',
  '/2025/10/07/documentary-review-the-rose-come-back-to-me': '/documentary-review-the-rose-come-back-to-me',
  '/2025/10/07/every-game-shown-at-day-of-the-devs': '/every-game-shown-at-day-of-the-devs',
  '/2025/10/07/feeding-the-frosh-orientation-with-cds': '/feeding-the-frosh-orientation-with-cds',
  '/2025/10/07/insomnia': '/insomnia',
  '/2025/10/07/integrated-core-launches-with-energy-at-the-center':
    '/integrated-core-launches-with-energy-at-the-center',
  '/2025/10/07/italian-heritage-month-between-memory-identity-and-the-legacy-of-renato-dulbecco':
    '/italian-heritage-month-between-memory-identity-and-the-legacy-of-renato-dulbecco',
  '/2025/10/07/opposition': '/opposition',
  '/2025/10/07/sudden-changes-to-nsf-s-graduate-fellowship-program':
    '/sudden-changes-to-nsfs-graduate-fellowship-program',
  '/2025/10/07/tasting-the-golden-state-at-foodfest': '/tasting-the-golden-state-at-foodfest',
  '/2025/10/07/the-inner-crack-of-women-in-science': '/the-inner-crack-of-women-in-science',
  '/2025/10/07/we-are-so-back-fall-25-athletics-at-caltech': '/we-are-so-back-fall-25-athletics-at-caltech',
  '/2025/10/07/what-i-learned-from-a-summer-of-organic-farming': '/what-i-learned-from-a-summer-of-organic-farming',
  '/2025/10/07/where-science-meets-the-sacred-reflections-from-a-journey-to-houston':
    '/where-science-meets-the-sacred-reflections-from-a-journey-to-houston',
  '/2025/10/07/young-journalists-speak-on-l-a-wildfires-impact-at-usc-initiative':
    '/young-journalists-speak-on-the-impact-of-the-wildfires-at-usc-initiative',
  '/2025/10/21/2025-nobel-prizes-announced': '/2025-nobel-prizes-announced',
  '/2025/10/21/2025-pasadena-coffee-passport-second-round-of-reviews':
    '/2025-pasadena-coffee-passport-second-round-of-reviews',
  '/2025/10/21/a-conversation-with-jocelyn-vargas-and-chris-barragan-caltech-accessibility-specialists':
    '/a-conversation-with-jocelyn-vargas-and-chris-barragan-caltech-accessibility-specialists',
  '/2025/10/21/an-appeal-to-the-seniors-leave-the-frosh-alone': '/an-appeal-to-the-seniors-leave-the-frosh-alone',
  '/2025/10/21/ascit-board-of-directors-meeting-minutes-october-19-2025':
    '/ascit-board-of-directors-meeting-minutes-october-19-2025',
  '/2025/10/21/beavers-battle-strong-across-fall-sports-as-season-heads-into-home-stretch':
    '/beavers-battle-strong-across-fall-sports-as-season-heads-into-home-stretch',
  '/2025/10/21/caltech-wildlife-crows-and-ravens': '/caltech-wildlife-crows-and-ravens',
  '/2025/10/21/every-game-shown-at-summer-games-fest': '/every-game-shown-at-summer-games-fest',
  '/2025/10/21/further-jpl-layoffs-amid-continued-nasa-uncertainty':
    '/further-jpl-layoffs-amid-continued-nasa-uncertainty',
  '/2025/10/21/how-do-we-as-scientists-respond-to-data-erasure': '/how-do-we-as-scientists-respond-to-data-erasure',
  '/2025/10/21/join-the-2026-student-life-and-experience-conference-slec-':
    '/join-the-2026-student-life-and-experience-conference-slec',
  '/2025/10/21/meet-joseph-greenwell-caltechs-new-avp-for-student-life':
    '/meet-joseph-greenwell-caltechs-new-avp-for-student-life',
  '/2025/10/21/scientific-discovery-as-sacred-encounter-reflections-on-quantum-fields-and-faith':
    '/scientific-discovery-as-sacred-encounter-reflections-on-quantum-fields-and-faith',
  '/2025/10/21/the-eight-directions-of-the-wind-at-the-huntington':
    '/the-eight-directions-of-the-wind-at-the-huntington',
  '/2025/10/21/the-wild-west-of-the-internet-returns': '/the-wild-west-of-the-internet-returns',
  '/2025/10/21/un-fortunately-we-now-have-an-h-index': '/unfortunately-we-now-have-an-h-index',
  '/2025/11/18/2025-pasadena-coffee-passport-third-round-of-reviews':
    '/2025-pasadena-coffee-passport-third-round-of-reviews',
  '/2025/11/18/a-letter-to-future-generations-on-the-philosophy-of-happiness-part-i-unhappiness':
    '/a-letter-to-future-generations-on-the-philosophy-of-happiness-part-i',
  '/2025/11/18/a-pinterhouse-fit-for-the-end-of-the-world': '/a-pinterhouse-fit-for-the-end-of-the-world',
  '/2025/11/18/a-talk-with-bill-gates-on-innovation-sacrifice-and-what-really-matters':
    '/a-talk-with-bill-gates-on-innovation-sacrifice-and-what-really-matters',
  '/2025/11/18/an-overdue-conversation-with-tom-mannion-caltech-s-cornerstone-of-student-life':
    '/an-overdue-conversation-with-tom-mannion-caltechs-cornerstone-of-student-life',
  '/2025/11/18/ascit-board-of-directors-meeting-minutes-november-16-2025':
    '/ascit-board-of-directors-meeting-minutes-november-16-2025',
  '/2025/11/18/behind-integrated-core-caltech-s-grand-experiment-in-first-year-teaching':
    '/behind-integrated-core-caltechs-grand-experiment-in-first-year-teaching',
  '/2025/11/18/gut-feelings-how-microbes-might-be-shaping-the-mind-and-more':
    '/gut-feelings-how-microbes-might-be-shaping-the-mindand-more',
  '/2025/11/18/nostalgia': '/nostalgia',
  '/2025/11/18/remembering-richard-kipling-and-the-future-of-student-journalism-at-caltech':
    '/remembering-richard-kipling-and-the-future-of-student-journalism-at-caltech',
  '/2025/11/18/richard-kipling-l-a-times-veteran-and-longtime-tech-advisor-dies-at-81':
    '/richard-kipling-la-times-veteran-and-longtime-tech-advisor-dies-at-81',
  '/2025/11/18/what-makes-caltech-special-a-letter-to-caltech-s-incoming-president':
    '/what-makes-caltech-special-a-letter-to-caltechs-incoming-president',
  '/2025/12/02/a-letter-to-future-generations-on-the-philosophy-of-happiness-part-ii':
    '/a-letter-to-future-generations-on-the-philosophy-of-happiness-part-ii',
  '/2025/12/02/caltech-wildlife-sunday-birding-with-pasadena-audubon-society':
    '/caltech-wildlife-sunday-birding-with-pasadena-audubon-society',
  '/2025/12/02/i-feel-wicked-act-i': '/i-feel-wicked-act-i',
  '/2025/12/02/meet-terry-tumey-caltech-s-new-athletic-director': '/meet-terry-tumey-caltechs-new-athletic-director',
  '/2025/12/02/should-you-play-chants-of-sennaar-': '/should-you-play-chants-of-senaar',
  '/2025/12/02/singapore-exclusive-hidden-twig-art-master': '/singapore-exclusive-hidden-twig-art-master',
  '/2025/12/02/the-enduring-power-of-gold': '/the-enduring-power-of-gold',
  '/2025/12/02/the-importance-of-earnest-theater-criticism-tacit-s-wild-ean-triumph':
    '/the-importance-of-earnest-theater-criticism-tacits-wildean-triumph',
  '/2025/12/02/the-room-of-the-impossible': '/the-room-of-the-impossible',
  '/2025/12/02/when-italian-echoes-found-me-6-000-miles-from-home-a-love-letter-to-la-boheme':
    '/when-italian-echoes-found-me-6000-miles-from-home-a-love-letter-to-la-boheme',
  '/2026/01/13/2025-pasadena-coffee-passport-final-round-of-reviews':
    '/2025-pasadena-coffee-passport-final-round-of-reviews',
  '/2026/01/13/a-journey-through-germany-austria-and-switzerland-san-pietro-summer-travel-prize':
    '/a-journey-through-germany-austria-and-switzerland-san-pietro-summer-travel-prize',
  '/2026/01/13/caltech-wildlife-the-pond-ecosystem': '/caltech-wildlife-the-pond-ecosystem',
  '/2026/01/13/filming-on-campus': '/filming-on-campus',
  '/2026/01/13/i-feel-wicked-act-ii': '/i-feel-wicked-act-ii',
  '/2026/01/13/i-think-i-like-it-a-devil-may-cry-3-review-': '/i-think-i-like-it-a-devil-may-cry-3-review',
  '/2026/01/13/in-memory-of-kenny-lau': '/in-memory-of-kenny-lau',
  '/2026/01/13/is-it-love-or-just-caltech-': '/is-it-love-or-just-caltech',
  '/2026/01/13/philosophy-of-happiness-part-iii':
    '/a-letter-to-future-generations-on-the-philosophy-of-happiness-part-iii',
  '/2026/01/13/rewriting-humanity-why-we-must-set-limits-on-designing-the-next-generation':
    '/rewriting-humanity-why-we-must-set-limits-on-designing-the-next-generation',
  '/2026/01/13/ski-trip-meanings-for-me': '/ski-trip-meanings-for-me',
  '/2026/01/13/the-usefulness-of-the-useless': '/the-usefulness-of-the-useless',
  '/2026/01/13/units-the-americans-have-it-right': '/units-the-americans-have-it-right',
  '/2026/01/27/2026-san-gabriel-valley-food-passport': '/2026-san-gabriel-valley-food-passport',
  '/2026/01/27/ace-attorney-review': '/ace-attorney-review',
  '/2026/01/27/an-evening-with-professor-francois-tissot': '/an-evening-with-professor-francois-tissot',
  '/2026/01/27/caltech-killing-eve-and-the-erotics-of-psychopathys':
    '/caltech-killing-eve-and-the-erotics-of-psychopathy',
  '/2026/01/27/fear-and-loathing-in-sfo': '/fear-and-loathing-in-san-francisco-intl-repertorial-miscellany',
  '/2026/01/27/journey-down-memory-lane': '/journey-down-memory-lane',
  '/2026/01/27/meet-dr-jordan-shlain': '/meet-dr-jordan-shlain-with-the-caltech-longevity-club',
  '/2026/01/27/on-the-philosophy-of-happiness-iv': '/on-the-philosophy-of-happiness-iv',
  '/2026/01/27/psa-from-the-mail-office': '/psa-from-the-mail-office',
  '/2026/01/27/ricketts-hosts-norse-themed-interhovse': '/ricketts-hosts-norse-themed-interhovse-party',
  '/2026/01/27/the-entropy-of-the-heart-a-report-from-the-caltech-mirage':
    '/entropy-of-the-heart-a-report-from-the-caltech-mirage',
  '/2026/01/27/the-myths-of-graduate-school':
    '/the-myths-of-graduate-school-what-to-consider-before-committing-to-a-phd-program',
  '/2026/01/27/tools-of-discovery': '/tools-of-discovery',
  '/2026/01/27/what-s-cooking-at-caltech': '/from-fine-dining-to-family-weekend-whats-cooking-at-caltech',
  '/2026/02/24/2026-san-gabriel-valley-food-passport': '/2026-san-gabriel-valley-food-passport',
  '/2026/02/24/a-call-for-transparency-and-stewardship-at-1364-e-green-street':
    '/a-call-for-transparency-and-stewardship-at-1364-e-green-street',
  '/2026/02/24/a-kiwi-adventure': '/a-kiwi-adventure',
  '/2026/02/24/banff-mountain-film-festival': '/20252026-banff-mountain-film-festival-world-tour-returns-to-caltech',
  '/2026/02/24/caltech-wildlife-turtles-and-the-turtle-club': '/caltech-wildlife-turtles-and-the-turtle-club',
  '/2026/02/24/campus-isn-t-safe-enough-a-proposal-to-eliminate-liability-and-house-culture':
    '/campus-isnt-safe-enough-a-proposal-to-eliminate-liability-and-house-culture',
  '/2026/02/24/cds-celebrates-black-history-month': '/cds-celebrates-black-history-month',
  '/2026/02/24/for-parker': '/for-parker',
  '/2026/02/24/innovating-through-irritation-with-dr-jordan-shlain':
    '/innovating-through-irritation-with-dr-jordan-shlain',
  '/2026/02/24/on-self-love': '/on-self-love',
  '/2026/02/24/remembering-parker-thompson': '/remembering-parker-thompson',
  '/2026/02/24/the-chilling-of-caltech': '/the-chilling-of-caltech',
  '/2026/02/24/the-eyes-that-search-for-tomorrow-part-1': '/the-eyes-that-search-for-tomorrow-part-i',
  '/2026/02/24/the-frontier-myth-in-motion-ads-of-super-bowl-lx': '/the-frontier-myth-in-motion-ads-of-super-bowl-lx',
  '/2026/02/24/the-mindshift-conference-nobel-laureates-an-academic-imposter-and-jeffrey-epstein':
    '/the-mindshift-conference-nobel-laureates-an-academic-impostor-and-jeffrey-epstein',
  '/2026/02/24/the-shape-of-canadian-quixotry-a-note-on-alberta-separatism':
    '/the-shape-of-canadian-quixotry-a-note-on-alberta-separatism',
  '/2026/02/24/the-zephyr': '/the-zephyr',
  '/2026/02/24/tomodachi-life': '/the-return-of-tomodachi-life',
  '/2026/02/24/tv-review-the-war-between-the-land-and-the-sea': '/tv-review-the-war-between-the-land-and-the-sea',
  '/2026/02/24/why-you-shouldn-t-buy-gta-vi': '/why-you-shouldnt-buy-gta-vi',
  '/2026/03/17/2026-san-gabriel-valley-food-passport-to-be-continued':
    '/2026-san-gabriel-valley-food-passport-to-be-continued',
  '/2026/03/17/a-letter-to-future-generations-on-the-philosophy-of-happiness-part-v':
    '/a-letter-to-future-generations-on-the-philosophy-of-happiness-part-v',
  '/2026/03/17/beavers-have-ice-in-their-veins-caltech-winter-25-26-athletics':
    '/beavers-have-ice-in-their-veins-caltech-winter-25-26-athletics',
  '/2026/03/17/caltech-astrophysicist-carl-griillmair-dies-at-67': '/caltech-astrophysicist-carl-grillmair-dies-at-67',
  '/2026/03/17/caltech-wildlife-hummingbirds': '/caltech-wildlife-hummingbirds',
  '/2026/03/17/congress-votes-to-retain-science-funding-declines-most-proposed-cuts':
    '/congress-votes-to-retain-science-funding-declines-most-proposed-cuts',
  '/2026/03/17/dabney-hosts-lunar-new-year-themed-interhovse': '/dabney-hosts-lunar-new-year-themed-interhovse',
  '/2026/03/17/dimming-the-sun-can-a-satellite-fleet-buy-earth-the-time-it-needs':
    '/dimming-the-sun-can-a-satellite-fleet-buy-earth-the-time-it-needs',
  '/2026/03/17/remembering-parker-thompson': '/remembering-parker-thompson',
  '/2026/03/17/stop-trying-to-convert-climate-deniers-a-psychologist-guide-to-actually-making-a-difference':
    '/stop-trying-to-convert-climate-deniers-a-psychologists-guide-to-actually-making-a-difference',
  '/2026/03/17/the-eyes-that-search-for-tomorrow-part-ii': '/the-eyes-that-search-for-tomorrow-part-ii',
  '/2026/03/17/the-friendships-that-introduced-european-modernism-to-california':
    '/the-friendships-that-introduced-european-modernism-to-california',
  '/2026/03/17/the-transcendental-return-of-pi-day': '/the-transcendental-return-of-pi-day',
  '/2026/03/17/the-unwritten-curriculum-of-keeping-good-mental-health-some-insider-tips':
    '/the-unwritten-curriculum-of-keeping-good-mental-health-some-insider-tips',
  '/2026/03/17/undergraduate-akshar-ramkumar-selected-as-2026-27-churchill-scholar':
    '/undergraduate-akshar-ramkumar-selected-as-2026-27-churchill-scholar',
  '/2026/03/17/venerable-hosts-spider-verse-themed-interhouse': '/venerable-hosts-spider-verse-themed-interhouse',
  '/2026/04/07/2026-san-gabriel-valley-food-passport-third-round-of-reviews':
    '/2026-san-gabriel-valley-food-passport-third-round-of-reviews',
  '/2026/04/07/artemis-ii-and-the-return-beyond-earth-orbit': '/artemis-ii-and-the-return-beyond-earth-orbit',
  '/2026/04/07/between-islands-and-identiy-what-hawai-i-gave-me-that-i-had-been-searching-for-all-my-life':
    '/between-islands-and-identity-what-hawaii-gave-me-that-i-had-been-searching-for-all-my-life',
  '/2026/04/07/caltech-debuts-orange-folder-to-aid-student-support':
    '/caltech-debuts-orange-folder-to-aid-student-support',
  '/2026/04/07/caltech-wildlife-parrots-and-parakeets': '/caltech-wildlife-parrots-and-parakeets',
  '/2026/04/07/lloyd-sends-guests-down-the-rabbit-hole-at-alice-themed-interhouse':
    '/lloyd-sends-guests-down-the-rabbit-hole-at-alice-themed-interhouse',
  '/2026/04/07/me-72-s-apex-cleanup-caltech-s-ultimate-design-showdown':
    '/me-72s-apex-cleanup-caltechs-ultimate-design-showdown',
  '/2026/04/07/nature-astronomy-study-demonstrates-the-feasibility-of-orbiting-starshade-for-ground-based-exoplanet-imaging':
    '/nature-astronomy-study-demonstrates-feasibility-of-orbiting-starshade-for-ground-based-exoplanet-imaging',
  '/2026/04/07/on-our-war': '/on-our-war',
  '/2026/04/07/spring-refreshes-new-seats-sustainability-and-supporting-our-community':
    '/spring-refreshes-new-seats-sustainability-and-supporting-our-community',
  '/2026/04/07/tusks-and-wonder-a-review-of-blood-ivory': '/tusks-and-wonder-a-review-of-blood-ivory',
  '/2026/04/07/two-lloyd-alleys-attempt-secession-establish-republic-of-nugget-amid-presidential-uncertainty':
    '/two-lloyd-alleys-attempt-secession-establish-republic-of-nugget-amid-presidential-uncertainty',
  '/2026/04/21/a-penumbra-of-human-mind': '/a-penumbra-of-human-mind',
  '/2026/04/21/artemis-ii-returns-crew-to-earth-demonstrates-new-recovery-operations-for-lunar-missions':
    '/artemis-ii-returns-crew-to-earth-demonstrates-new-recovery-operations-for-lunar-missions',
  '/2026/04/21/booth-kresa-gift-endows-caltech-aerospace-department-signals-new-era-of-expansion':
    '/booth-kresa-gift-endows-caltech-aerospace-department-signals-new-era-of-expansion',
  '/2026/04/21/caltech-wildlife-butterflies': '/caltech-wildlife-butterflies',
  '/2026/04/21/case-workshop-2026-beckman-political-award-the-little-italian-girl-heads-to-washington-dc':
    '/case-workshop-2026-beckman-political-award-the-little-italian-girl-heads-to-washington-dc',
  '/2026/04/21/our-trip-to-d-c---the-life-cycle-of-the-scientific-idea':
    '/our-trip-to-dc-the-life-cycle-of-the-scientific-idea',
  '/2026/04/21/student-life-and-experience-caltech-hosts-2026-slec-conference':
    '/student-life-and-experience-caltech-hosts-2026-slec-conference',
  '/2026/05/19/2026-san-gabriel-valley-food-passport--fourth-round-of-reviews':
    '/2026-san-gabriel-valley-food-passport-fourth-round-of-reviews',
  '/2026/05/19/a-midsummer-night-s-dream-at-ramo--shakespeare-with-heart-and-laughter':
    '/a-midsummer-nights-dream-at-ramo-shakespeare-with-heart-and-laughter',
  '/2026/05/19/ai--ethics--and-the-art-of-culpability--an-evening-with-bruce-holsinger-at-caltech':
    '/ai-ethics-and-the-art-of-culpability-an-evening-with-bruce-holsinger-at-caltech',
  '/2026/05/19/all-22-national-science-board-members-removed': '/all-22-national-science-board-members-removed',
  '/2026/05/19/blacker-raises-the-neon-pyramid': '/blacker-raises-the-neon-pyramid',
  '/2026/05/19/caltech-alumnus-accused-in-washington-correspondents--dinner-attack':
    '/caltech-alumnus-accused-in-washington-correspondents-dinner-attack',
  '/2026/05/19/caltech-students-in-boulder--co--apartment-hunting': '/caltech-students-in-boulder-co-apartment-hunting',
  '/2026/05/19/canvas-breach-prompts-caution--limited-use-guidance-at-caltech':
    '/canvas-breach-prompts-caution-limited-use-guidance-at-caltech',
  '/2026/05/19/fleming-celebrates-2016-nostalgia-at--flemchella-': '/fleming-celebrates-2016-nostalgia-at-flemchella',
  '/2026/05/19/how-did-i-learn-to-say-goodbye-': '/how-did-i-learn-to-say-goodbye',
  '/2026/05/19/late-spring-greetings-from-housing-and-dining-services':
    '/late-spring-greetings-from-housing-and-dining-services',
  '/2026/05/19/old-darb-alum-speaks-out': '/old-darb-alum-speaks-out',
  '/2026/05/19/robert-indiana-s-love-to-join-the-huntington-s-collection':
    '/robert-indianas-love-to-join-the-huntingtons-collection',
  '/2026/05/19/spring-wildlife--parenting': '/spring-wildlife-parenting',
  '/2026/05/19/the-strange-attractor---did-caltech-host-the-world-s-first-successful-gathering-of-time-travelers-':
    '/the-strange-attractor-did-caltech-host-the-worlds-first-successful-gathering-of-time-travelers',
  '/2026/05/19/to-san-francisco--and-nowhere--tacit-s-incorrigible-three-sisters':
    '/to-san-francisco-and-nowhere-tacits-incorrigible-three-sisters',
  '/2026/05/19/what-s-with-the-dead-grass-on-south-wilson-': '/whats-with-the-dead-grass-on-south-wilson',
  '/2026/06/02/as-we-scatter-to-the-winds': '/as-we-scatter-to-the-winds',
  '/2026/06/02/caltech-y-volunteers-remove-ivy-at-the-la-arboretum-for-make-a-difference-day':
    '/caltech-y-volunteers-remove-ivy-at-the-la-arboretum-for-make-a-difference-day',
  '/2026/06/02/cds-responds-to-reddit-post': '/cds-responds-to-reddit-post-alleging-issues-at-browne-dining-hall',
  '/2026/06/02/end-of-term-wishing-you-a-great-summer-from-housing-and-dining':
    '/end-of-term-wishing-you-a-great-summer-from-housing-and-dining',
  '/2026/06/02/fearlessness-community-and-unfinished-work-rosenbaum-on-his-caltech-presidency':
    '/fearlessness-community-and-unfinished-work-rosenbaum-on-his-caltech-presidency',
  '/2026/06/02/from-nightclub-door-lists-to-fashion-s-front-row-the-unlikely-journey-of-melissa-magsaysay':
    '/from-nightclub-door-lists-to-fashions-front-row-the-unlikely-journey-of-melissa-magsaysay',
  '/2026/06/02/integrated-core-one-year-later': '/integrated-core-one-year-later',
  '/2026/06/02/nasa-to-compete-jpl-management-contract-as-caltech-prepares-bid':
    '/nasa-to-compete-jpl-management-contract-as-caltech-prepares-bid',
  '/2026/06/02/opera-s-rising-stars-the-pasadena-vocal-competition':
    '/operas-rising-stars-the-pasadena-vocal-competition',
  '/2026/06/02/seeking-student-perspectives-on-the-honor-code-and-in-person-exams':
    '/seeking-student-perspectives-on-the-honor-code-and-in-person-exams',
  '/2026/06/02/senator-adam-schiff-goes-down-the-quantum-rabbit-hole-at-caltech':
    '/senator-adam-schiff-goes-down-the-quantum-rabbit-hole-at-caltech',
  '/2026/06/02/the-invisible-on-mental-health-awareness-month': '/the-invisible-on-mental-health-awareness-month',
  '/2026/06/02/the-work-continues': '/the-work-continues',
  '/2026/06/02/two-random-food-reviews': '/two-random-food-reviews',
  '/2026/06/02/when-science-meets-the-streets': '/when-science-meets-the-streets',
  '/2026/06/02/who-gets-believed-under-a-warming-sun': '/who-gets-believed-under-a-warming-sun',
};

/** Old article URLs are all dated: /2023/04/slug/ or /2023/10/17/slug/. */
const LEGACY_PATH = /^\/20\d\d\//;

export function normalizeLegacyPath(pathname: string): string {
  let path = pathname;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    // A malformed escape: match it as written.
  }
  return path.replace(/\/+$/, '').toLowerCase();
}

/** The new path for an old-site URL, or null. */
export function legacyRedirect(pathname: string): string | null {
  if (!LEGACY_PATH.test(pathname)) return null;
  return LEGACY_REDIRECTS[normalizeLegacyPath(pathname)] ?? null;
}
