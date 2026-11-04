-- ─────────────────────────────────────────────────────────────────────────────
-- Content refresh (v1.2.0). Every statement only touches values still equal to the
-- original seed, so anything already edited from the back office is left alone.
-- ─────────────────────────────────────────────────────────────────────────────

-- professional address for the public contact and the legal pages (Google sign-in keeps ADMIN_EMAIL)
update site_settings set public_email = 'maxence.bonnici@outlook.fr'
 where public_email = 'maxence.bonnici2002@gmail.com';
update site_settings set legal_contact_email = 'maxence.bonnici@outlook.fr'
 where legal_contact_email = 'maxence.bonnici2002@gmail.com';

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
