-- Test fixtures: the original portfolio content (former V2 seed + V4 refresh), loaded after the
-- versioned migrations in the 'test' profile only (spring.flyway.locations). Production starts empty.
delete from site_settings;
-- ─────────────────────────────────────────────────────────────────────────────
-- Initial content. Everything here is editable from the back office.
-- ─────────────────────────────────────────────────────────────────────────────

insert into site_settings (
  id, owner_name, headline_fr, headline_en, bio_fr, bio_en, location, public_email,
  github_url, linkedin_url, availability,
  seo_title_fr, seo_title_en, seo_description_fr, seo_description_en,
  legal_name, legal_address, legal_host, legal_contact_email
) values (
  1, 'Maxence Bonnici',
  'Développeur Full Stack Java & Angular',
  'Full Stack Developer, Java & Angular',
  'Ingénieur logiciel basé à Aix-en-Provence. Je conçois des applications web complètes, du schéma de base de données jusqu''au dernier pixel : Spring Boot côté serveur, Angular côté navigateur, le tout conteneurisé et déployé sur mon propre serveur.

Diplômé d''EPITECH, j''ai passé près de trois ans chez MONEXT à développer et automatiser les tests de services de paiement, avant de rejoindre Sopra Steria sur des projets pour Airbus Helicopters. En dehors du travail, je construis des outils qui tournent entièrement dans le navigateur, sans compte ni serveur.',
  'Software engineer based in Aix-en-Provence, France. I build complete web applications, from the database schema to the last pixel: Spring Boot on the server, Angular in the browser, all containerised and deployed on my own server.

An EPITECH graduate, I spent almost three years at MONEXT developing and automating tests for payment services before joining Sopra Steria on projects for Airbus Helicopters. Outside work I build tools that run entirely in the browser, with no account and no server.',
  'Aix-en-Provence, France',
  'maxence.bonnici@outlook.fr',
  'https://github.com/ImMaxence',
  'https://www.linkedin.com/in/maxence-bonnici-77b540250/',
  'LISTENING',
  'Maxence Bonnici — Développeur Full Stack Java & Angular',
  'Maxence Bonnici — Full Stack Developer, Java & Angular',
  'Portfolio de Maxence Bonnici, développeur full stack Java / Spring Boot et Angular à Aix-en-Provence : projets, expériences et outils open source.',
  'Portfolio of Maxence Bonnici, full stack developer (Java / Spring Boot and Angular) in Aix-en-Provence, France: projects, experience and open-source tools.',
  'Maxence Bonnici', '', 'Serveur personnel auto-hébergé en France, exposé via Cloudflare, Inc. (101 Townsend St, San Francisco, CA 94107, USA)', 'maxence.bonnici@outlook.fr'
);

-- Experience (most recent first)
insert into experience (company, company_url, role_fr, role_en, description_fr, description_en, location, contract_type, start_date, end_date, skills, sort_order) values
('Sopra Steria', 'https://www.soprasteria.com', 'Développeur Full Stack', 'Full Stack Developer',
 'Mission Aéroline Sud-Est pour Airbus Helicopters : développement d''applications métier en Spring Boot et Angular Material, de la conception des API à l''intégration continue.',
 'Aéroline Sud-Est assignment for Airbus Helicopters: business applications built with Spring Boot and Angular Material, from API design to continuous integration.',
 'Aix-en-Provence, France', 'CDI', '2025-10-01', null, '{Spring Boot,Angular,Angular Material,Java,PostgreSQL,CI/CD}', 0),
('MONEXT', 'https://www.monext.fr', 'Développeur Java & Testeur automatisation', 'Java Developer & Test Automation Engineer',
 'Alternance de 2 ans et 8 mois au sein d''un acteur majeur du paiement : développement de services Java, automatisation des tests de non-régression et outillage de la chaîne de livraison.',
 'A 2-year-8-month work-study placement at a major payment company: Java service development, automated non-regression testing and delivery tooling.',
 'Aix-en-Provence, France', 'ALTERNANCE', '2023-01-01', '2025-08-31', '{Java,Spring,Automatisation des tests,Selenium,SQL,Jenkins,Git}', 1),
('Kortex Consulting', null, 'Développeur C & Python', 'C & Python Developer',
 'Stage de 4 mois : développement d''outils en C et Python.',
 'Four-month internship developing tools in C and Python.',
 'Gardanne, France', 'STAGE', '2021-05-01', '2021-08-31', '{C,Python,Linux}', 2);

insert into education (school, school_url, degree_fr, degree_en, location, start_date, end_date, sort_order) values
('EPITECH — European Institute of Technology', 'https://www.epitech.eu', 'Expert en technologies de l''information (titre RNCP niveau 7)', 'Information Technology Expert (Master''s level)', 'Marseille, France', '2022-09-01', '2025-08-31', 0);

insert into skill (name, category, level, sort_order) values
('Java', 'LANGUAGE', 5, 0), ('TypeScript', 'LANGUAGE', 5, 1), ('JavaScript', 'LANGUAGE', 5, 2), ('SQL', 'LANGUAGE', 4, 3), ('Python', 'LANGUAGE', 3, 4), ('C', 'LANGUAGE', 3, 5),
('Spring Boot', 'FRAMEWORK', 5, 10), ('Angular', 'FRAMEWORK', 5, 11), ('React', 'FRAMEWORK', 4, 12), ('React Native', 'FRAMEWORK', 3, 13), ('Node.js / Express', 'FRAMEWORK', 4, 14),
('PostgreSQL', 'DATABASE', 4, 20), ('MongoDB', 'DATABASE', 3, 21),
('Docker & Compose', 'DEVOPS', 5, 30), ('Coolify', 'DEVOPS', 4, 31), ('Cloudflare', 'DEVOPS', 4, 32), ('GitHub Actions', 'DEVOPS', 4, 33), ('nginx', 'DEVOPS', 4, 34), ('Linux', 'DEVOPS', 4, 35),
('Playwright / Selenium', 'TOOL', 4, 40), ('Git', 'TOOL', 5, 41), ('Figma', 'TOOL', 3, 42),
('Tests automatisés', 'PRACTICE', 5, 50), ('Clean code', 'PRACTICE', 4, 51), ('Accessibilité', 'PRACTICE', 4, 52), ('SEO', 'PRACTICE', 4, 53);

-- Projects
insert into project (slug, title_fr, title_en, tagline_fr, tagline_en, description_fr, description_en, status, featured, sort_order, year, category, accent_color, repo_url, live_url, allow_iframe, stack, published_at) values
('localatscv', 'LocalATSCV', 'LocalATSCV',
 'Le CV qui décroche l''entretien, prêt en quelques minutes. Gratuit, sans compte, 100 % local.',
 'The resume that gets you the interview, ready in minutes. Free, no sign-up, 100% local.',
 'La plupart des entreprises passent chaque candidature dans un **ATS** avant qu''un humain ne la lise. Un CV construit à partir de blocs graphiques en ressort souvent en texte brouillé. Et la plupart des générateurs en ligne veulent votre e-mail, votre carrière complète sur leurs serveurs, puis un abonnement pour télécharger le PDF.

LocalATSCV donne les deux : des mises en page qui plaisent aux recruteurs et du vrai texte que les robots lisent dans le bon ordre. Sans compte, sans paywall, et sans envoyer un seul octet de votre CV où que ce soit.

- 72 modèles, 44 langues d''interface, PWA installable qui fonctionne hors ligne
- Vérification ATS intégrée à l''éditeur et adaptation d''un CV maître à chaque offre
- Export PDF généré entièrement dans le navigateur',
 'Most companies run every application through an **ATS** before a human ever sees it. A resume built from free-floating design blocks often comes out as scrambled text. And most online builders want your email, your whole career on their servers, then a subscription to download the PDF.

LocalATSCV gives you both: designs recruiters like and real text that robots read in the right order. No account, no paywall, and not a single byte of your resume sent anywhere.

- 72 templates, 44 interface languages, installable PWA that works offline
- ATS check built into the editor, tailor one master resume to every job
- PDF export generated entirely in the browser',
 'PUBLISHED', true, 0, 2026, 'TOOL', '#f0582b', 'https://github.com/ImMaxence/LocalATSCV', 'https://localatscv.mbonnici.fr/', true,
 '{Angular 22,TypeScript,PWA,Génération PDF,i18n}', now()),

('localcutvideo', 'LocalCutVideo', 'LocalCutVideo',
 'Montez vos vidéos en un clic. Rien ne quitte votre ordinateur.',
 'Edit your videos in one click. Nothing leaves your computer.',
 'L''alternative libre et gratuite à CapCut pour les vidéos face caméra : silences coupés, sous-titres animés, format TikTok avec suivi du visage et export MP4, le tout à 100 % dans le navigateur. Pas d''upload, pas de compte, pas de filigrane.

- **Montage automatique** : transcription, suppression des hésitations, coupe des silences, recadrage sur le visage, zoom intelligent et sous-titres karaoké en un clic
- Flou d''arrière-plan par segmentation, textes et transitions, générateur de miniatures
- La vidéo est lue en place depuis le disque (File System Access API) : rien n''est envoyé nulle part',
 'The free, open-source CapCut alternative for talking-head videos: silences cut, animated subtitles, TikTok format with face tracking and MP4 export, running 100% in the browser. No upload, no account, no watermark.

- **Auto edit**: transcription, filler removal, silence cuts, face framing, smart zoom and karaoke subtitles in one click
- Background blur through segmentation, titles and transitions, thumbnail maker
- The video is read in place from your disk (File System Access API): nothing is sent anywhere',
 'PUBLISHED', true, 1, 2026, 'TOOL', '#7c5cff', 'https://github.com/ImMaxence/LocalCutVideo', 'https://localcutvideo.mbonnici.fr', true,
 '{Angular,TypeScript,WebCodecs,Whisper (WASM),MediaPipe,Web Workers}', now()),

('meowtrix', 'Meowtrix', 'Meowtrix',
 'Transformez n''importe quel écran en terrain de chasse pour votre chat.',
 'Turn any screen into a hunting ground for your cat.',
 'Des lézards filent entre les pierres, des koïs remontent à la surface, des papillons voltigent juste hors de portée, et quand une patte se pose sur l''un d''eux, il détale. Meowtrix est un jeu plein écran gratuit, conçu pour les chats : des animaux 3D réalistes qui errent, se cachent et fuient, sur un téléphone, une tablette, un ordinateur ou une télé.

- **Des proies qui se comportent comme des proies** : chaque animal est simulé, pas animé (colonne vertébrale souple, pattes qui marchent vraiment, queue qui suit)
- Trois mondes (terre, eau, ciel), sons synthétisés en direct, réaction aux bruits de la pièce via le micro
- La vitesse s''adapte au chat et chaque session se termine sur une prise',
 'Lizards dart between the stones, koi rise to the surface, butterflies flutter just out of reach, and when a paw lands on one, it bolts. Meowtrix is a free, full-screen game made for cats: lifelike 3D animals that wander, hide and flee, on a phone, a tablet, a laptop or a TV.

- **Prey that behaves like prey**: every animal is simulated, not animated (supple spine, legs that actually step, a tail that follows)
- Three worlds (land, water, sky), live-synthesised sound, reacts to real room noises through the microphone
- Speed adapts to the cat and every session ends on a catch',
 'PUBLISHED', true, 2, 2026, 'GAME', '#2dd4a0', 'https://github.com/ImMaxence/meowtrix', 'https://meowtrix.mbonnici.fr/', true,
 '{TypeScript,Canvas,3D procédural,Web Audio,PWA}', now()),

('a2e-environnement', 'A2E Environnement', 'A2E Environnement',
 'Refonte complète du site d''un bureau d''études en eau, assainissement et sols.',
 'Complete redesign of an environmental engineering firm''s website.',
 'Refonte du site d''A2E Environnement, bureau d''études spécialisé dans l''eau, l''assainissement et les sols. Un site vitrine rapide, multilingue (français, anglais, espagnol, italien) avec thème clair et sombre, pensé pour le référencement local.

- Angular 22 en SPA avec pages chargées à la demande et polices auto-hébergées
- Dictionnaire typé : une traduction manquante fait échouer le build
- Conteneurisé avec nginx et déployé via Docker Compose sur Coolify',
 'Redesign of the website of A2E Environnement, an engineering firm specialised in water, sanitation and soils. A fast, multilingual showcase site (French, English, Spanish, Italian) with light and dark themes, built for local SEO.

- Angular 22 SPA with lazy-loaded pages and self-hosted fonts
- Typed dictionary: a missing translation fails the build
- Containerised with nginx and deployed with Docker Compose on Coolify',
 'PUBLISHED', false, 3, 2026, 'WEB', '#1f8ef1', 'https://github.com/ImMaxence/a2e', 'https://a2e.mbonnici.fr/', true,
 '{Angular 22,TypeScript,i18n,nginx,Docker}', now()),

('les-creations-de-yona', 'Les créations de Yona', 'Les créations de Yona',
 'Un blog de cuisine installable, avec mode cuisine, liste de courses et notifications.',
 'An installable cooking blog with a kitchen mode, shopping list and push notifications.',
 'Le blog de cuisine et de pâtisserie de Yona : des recettes à suivre depuis son téléphone, une application installable et un back-office pour les écrire.

- Recherche intelligente (« gâteau 8 », « dessert en 30 min », « sans cuisson »), portions ajustables, mode cuisine qui garde l''écran allumé
- Liste de courses, glossaire, thème sombre, notifications push à chaque nouvelle recette
- Back-office complet pour rédiger, illustrer et publier',
 'Yona''s cooking and baking blog: recipes to follow from a phone, an installable app and a back office to write them.

- Smart search ("cake for 8", "dessert in 30 min", "no bake"), adjustable servings, kitchen mode that keeps the screen on
- Shopping list, glossary, dark theme, push notifications for every new recipe
- Full back office to write, illustrate and publish',
 'PUBLISHED', true, 4, 2026, 'WEB', '#e8713c', 'https://github.com/ImMaxence/les-creations-de-yona', 'https://les-creations-de-yona.fr/', false,
 '{TypeScript,PWA,Notifications push,Back-office}', now()),

('clienthub-crm', 'ClientHub CRM', 'ClientHub CRM',
 'Un CRM complet, Angular et Spring Boot, entièrement conteneurisé.',
 'A complete CRM, Angular and Spring Boot, fully containerised.',
 'ClientHub est une solution de gestion de la relation client conçue pour centraliser les informations clients, suivre les interactions commerciales et fournir des statistiques utiles aux équipes.

- API REST Spring Boot 3 sécurisée par JWT, base PostgreSQL
- Interface Angular 20 responsive avec tableaux de bord
- Orchestration Docker Compose avec nginx en frontal',
 'ClientHub is a customer relationship management solution designed to centralise customer data, track sales interactions and provide useful statistics to teams.

- Spring Boot 3 REST API secured with JWT, PostgreSQL database
- Responsive Angular 20 interface with dashboards
- Docker Compose orchestration with nginx in front',
 'PUBLISHED', false, 5, 2025, 'WEB', '#0ea5e9', 'https://github.com/ImMaxence/ClientHub-CRM', 'https://clienthub.mbonnici.fr', false,
 '{Angular 20,Spring Boot 3,PostgreSQL,JWT,Docker Compose,nginx}', now()),

('epic-road-trip-planner', 'Epic Road Trip Planner', 'Epic Road Trip Planner',
 'Planifier un road trip en France, étape par étape, sur une carte.',
 'Plan a road trip across France, stop by stop, on a map.',
 'Projet EPITECH : une application web pour planifier des road trips en France. Recherche d''étapes, hébergements et activités sur une carte interactive, export de l''itinéraire en PDF.

- Carte Leaflet sur fond OpenStreetMap
- API Node / Express développée en TDD
- Interface React avec Ant Design et export React-PDF',
 'EPITECH project: a web application to plan road trips across France. Search for stops, accommodation and activities on an interactive map, export the itinerary as a PDF.

- Leaflet map on OpenStreetMap tiles
- Node / Express API developed with TDD
- React interface with Ant Design and React-PDF export',
 'PUBLISHED', false, 6, 2024, 'WEB', '#22c55e', 'https://github.com/ImMaxence/Epic-Road-Trip-Planner', null, false,
 '{React,Node.js,Express,Leaflet,OpenStreetMap,TDD}', now()),

('time-manager', 'Time Manager', 'Time Manager',
 'Suivi du temps de travail pour les équipes, web et mobile.',
 'Working-time tracking for teams, web and mobile.',
 'Projet EPITECH : une plateforme de gestion du temps pour les particuliers et les organisations, avec pointage, tableaux de bord et gestion d''équipes.

- API Elixir / Phoenix conteneurisée
- Client web React et application mobile React Native
- Maquettes Figma puis intégration pixel-perfect',
 'EPITECH project: a time-management platform for individuals and organisations, with clock-in, dashboards and team management.

- Containerised Elixir / Phoenix API
- React web client and React Native mobile app
- Figma mock-ups then pixel-perfect integration',
 'PUBLISHED', false, 7, 2024, 'MOBILE', '#a855f7', 'https://github.com/ImMaxence/Time-Manager', null, false,
 '{React,React Native,Elixir,Phoenix,Docker,Figma}', now()),

('kryptonews', 'Kryptonews', 'Kryptonews',
 'L''actualité des cryptomonnaies, agrégée et mise en page.',
 'Cryptocurrency news, aggregated and laid out.',
 'Projet EPITECH : une application web centrée sur les cryptomonnaies, agrégeant des flux RSS et des données de marché.

- Agrégation de flux RSS côté serveur Node / Express
- Interface React, maquettes Figma
- Déploiement HTTPS sur un domaine dédié',
 'EPITECH project: a web application centred on cryptocurrencies, aggregating RSS feeds and market data.

- Server-side RSS aggregation with Node / Express
- React interface, Figma mock-ups
- HTTPS deployment on a dedicated domain',
 'PUBLISHED', false, 8, 2024, 'WEB', '#f59e0b', 'https://github.com/ImMaxence/Kryptonews', null, false,
 '{React,Node.js,Express,RSS}', now()),

('redditech', 'Redditech', 'Redditech',
 'Un client Reddit mobile avec OAuth2 et défilement infini.',
 'A mobile Reddit client with OAuth2 and infinite scrolling.',
 'Projet EPITECH : un client Reddit en React Native. Connexion OAuth2, navigation par subreddit, défilement automatique et profil utilisateur.',
 'EPITECH project: a Reddit client in React Native. OAuth2 login, subreddit browsing, auto-scrolling and user profile.',
 'PUBLISHED', false, 9, 2023, 'MOBILE', '#ff4500', 'https://github.com/ImMaxence/Redditech', null, false,
 '{React Native,OAuth2,Reddit API}', now()),

('mern-irc', 'MERN IRC', 'MERN IRC',
 'Un IRC temps réel en MongoDB, Express, React, Node et Socket.IO.',
 'A real-time IRC built with MongoDB, Express, React, Node and Socket.IO.',
 'Projet EPITECH : une messagerie instantanée inspirée d''IRC. Canaux, messages en temps réel via Socket.IO, interface responsive.',
 'EPITECH project: an IRC-inspired instant messaging app. Channels, real-time messages over Socket.IO, responsive interface.',
 'PUBLISHED', false, 10, 2023, 'WEB', '#06b6d4', 'https://github.com/ImMaxence/MERN-IRC-SocketIO', null, false,
 '{MongoDB,Express,React,Node.js,Socket.IO}', now()),

('nailsbyanastasie', 'Nails by Anastasie', 'Nails by Anastasie',
 'Site vitrine d''une prothésiste ongulaire.',
 'Showcase website for a nail technician.',
 'Site vitrine pour une prothésiste ongulaire : prestations, galerie et prise de contact.',
 'Showcase website for a nail technician: services, gallery and contact.',
 'DRAFT', false, 11, 2026, 'WEB', '#f472b6', 'https://github.com/ImMaxence/nailsbyanastasie', 'https://nailsbyanastasie.fr', false,
 '{HTML,CSS,JavaScript}', null);

-- ─────────────────────────────────────────────────────────────────────────────
-- Content refresh (v1.2.0). Every statement only touches values still equal to the
-- original seed, so anything already edited from the back office is left alone.
-- ─────────────────────────────────────────────────────────────────────────────

-- bio: a 100 % technical path, agile teamwork, and no more "no server" claim
update site_settings set bio_fr = replace(bio_fr,
  'Diplômé d''EPITECH, j''ai passé près de trois ans chez MONEXT à développer et automatiser les tests de services de paiement, avant de rejoindre Sopra Steria sur des projets pour Airbus Helicopters. En dehors du travail, je construis des outils qui tournent entièrement dans le navigateur, sans compte ni serveur.',
  'Un parcours 100 % technique, porté par la passion : Bac STI2D, BTS Systèmes Numériques, puis un Master Architecte logiciel et développement informatique à EPITECH. J''ai passé près de trois ans chez MONEXT à développer et automatiser les tests de services de paiement, avant de rejoindre Sopra Steria sur des projets pour Airbus Helicopters

Habitué des équipes agiles (Scrum, Jira, Confluence) : chiffrage des tâches, revues de code et montée en compétence des nouveaux arrivants. En dehors du travail, je conçois et héberge mes propres projets, des outils qui tournent dans le navigateur jusqu''aux applications full stack comme ce site')
 where bio_fr like '%sans compte ni serveur.%';

update site_settings set bio_en = replace(bio_en,
  'An EPITECH graduate, I spent almost three years at MONEXT developing and automating tests for payment services before joining Sopra Steria on projects for Airbus Helicopters. Outside work I build tools that run entirely in the browser, with no account and no server.',
  'A 100% technical path, driven by passion: a technology baccalaureate (STI2D), a two-year degree in digital systems (BTS SN), then a Master''s in software architecture and development at EPITECH. I spent almost three years at MONEXT developing and automating tests for payment services before joining Sopra Steria on projects for Airbus Helicopters

Used to agile teams (Scrum, Jira, Confluence): estimating tasks, code reviews and helping newcomers ramp up. Outside work I design and host my own projects, from tools that run in the browser to full stack applications like this site')
 where bio_en like '%with no account and no server.%';

update site_settings set bio_fr = replace(bio_fr, 'déployé sur mon propre serveur.', 'déployé sur mon propre serveur')
 where bio_fr like '%déployé sur mon propre serveur.%';
update site_settings set bio_en = replace(bio_en, 'deployed on my own server.', 'deployed on my own server')
 where bio_en like '%deployed on my own server.%';

-- current assignment: the Python / messaging / cloud side of the job
update experience set
  description_fr = 'Mission Aéroline Sud-Est pour Airbus Helicopters : applications métier en Spring Boot et Angular Material, services Python (Flask, Redis), messagerie MQTT avec HiveMQ, déploiement sur OpenShift et Azure Stack avec stockage S3. De la conception des API à l''intégration continue, en équipe Scrum',
  description_en = 'Aéroline Sud-Est assignment for Airbus Helicopters: business applications built with Spring Boot and Angular Material, Python services (Flask, Redis), MQTT messaging with HiveMQ, deployed on OpenShift and Azure Stack with S3 storage. From API design to continuous integration, in a Scrum team',
  skills = '{Spring Boot,Angular Material,Java,Python,Flask,Redis,HiveMQ,OpenShift,Azure Stack,S3,CI/CD}'
 where company = 'Sopra Steria' and start_date = '2025-10-01'
   and skills = '{Spring Boot,Angular,Angular Material,Java,PostgreSQL,CI/CD}';

update experience set
  description_fr = 'Alternance de 2 ans et 8 mois au sein d''un acteur majeur du paiement : développement de services Java, automatisation des tests de non-régression et outillage de la chaîne de livraison',
  description_en = 'A 2-year-8-month work-study placement at a major payment company: Java service development, automated non-regression testing and delivery tooling',
  skills = '{Java,Spring,Selenium,SQL,Jenkins,Git,Scrum}'
 where company = 'MONEXT' and skills = '{Java,Spring,Automatisation des tests,Selenium,SQL,Jenkins,Git}';

update experience set
  description_fr = 'Stage de 4 mois : développement d''outils en C et Python sous Linux',
  description_en = 'Four-month internship developing tools in C and Python on Linux'
 where company = 'Kortex Consulting' and description_fr = 'Stage de 4 mois : développement d''outils en C et Python.';

update education set
  degree_fr = 'Master Architecte logiciel et développement informatique',
  degree_en = 'Master''s degree, software architecture and development'
 where school like 'EPITECH%' and degree_fr = 'Expert en technologies de l''information (titre RNCP niveau 7)';

-- skills: "automated testing" duplicated Playwright / Selenium
delete from skill where name = 'Tests automatisés' and category = 'PRACTICE';
update skill set name = 'SEO technique' where name = 'SEO' and category = 'PRACTICE';

insert into skill (name, category, level, sort_order)
select v.name, v.category, v.level, v.sort_order
  from (values
    ('C++ (ESP32)', 'LANGUAGE', 3, 6),
    ('Dart', 'LANGUAGE', 3, 7),
    ('Flask', 'FRAMEWORK', 4, 15),
    ('Flutter', 'FRAMEWORK', 3, 16),
    ('Redis', 'DATABASE', 4, 22),
    ('GitLab CI', 'DEVOPS', 4, 36),
    ('OpenShift (OCP)', 'DEVOPS', 3, 37),
    ('Azure Stack', 'DEVOPS', 3, 38),
    ('Stockage S3', 'DEVOPS', 4, 39),
    ('Jira & Confluence', 'TOOL', 4, 43),
    ('Claude Code', 'TOOL', 4, 44),
    ('Scrum', 'PRACTICE', 4, 54),
    ('SEO pour les moteurs IA', 'PRACTICE', 3, 55),
    ('MQTT · HiveMQ', 'NETWORK', 3, 60),
    ('OAuth2 · OpenID Connect', 'NETWORK', 4, 61),
    ('SSH & durcissement serveur', 'NETWORK', 4, 62),
    ('fail2ban', 'NETWORK', 4, 63),
    ('Cockpit', 'NETWORK', 3, 64),
    ('Réseaux TCP/IP', 'NETWORK', 4, 65)
  ) as v(name, category, level, sort_order)
 where not exists (select 1 from skill s where lower(s.name) = lower(v.name));

-- taglines made of two sentences become one (the site copy has no full stops)
update project set tagline_fr = 'Le CV qui décroche l''entretien, prêt en quelques minutes : gratuit, sans compte, 100 % local'
 where slug = 'localatscv' and tagline_fr = 'Le CV qui décroche l''entretien, prêt en quelques minutes. Gratuit, sans compte, 100 % local.';
update project set tagline_en = 'The resume that gets you the interview, ready in minutes: free, no sign-up, 100% local'
 where slug = 'localatscv' and tagline_en = 'The resume that gets you the interview, ready in minutes. Free, no sign-up, 100% local.';
update project set tagline_fr = 'Montez vos vidéos en un clic, sans que rien ne quitte votre ordinateur'
 where slug = 'localcutvideo' and tagline_fr = 'Montez vos vidéos en un clic. Rien ne quitte votre ordinateur.';
update project set tagline_en = 'Edit your videos in one click, without anything leaving your computer'
 where slug = 'localcutvideo' and tagline_en = 'Edit your videos in one click. Nothing leaves your computer.';

-- taglines and project texts shown on the site end without a full stop
update project set tagline_fr = left(tagline_fr, -1) where tagline_fr like '%.' and tagline_fr not like '%..';
update project set tagline_en = left(tagline_en, -1) where tagline_en like '%.' and tagline_en not like '%..';
update site_settings set legal_host = left(legal_host, -1) where legal_host like '%.';

-- the seeded sites send "frame-ancestors 'none' / 'self'": the live preview would stay blank.
-- Re-enable it per project once the site allows https://mbonnici.fr as a frame ancestor.
update project set allow_iframe = false
 where allow_iframe and slug in ('localatscv', 'localcutvideo', 'meowtrix', 'a2e-environnement');
