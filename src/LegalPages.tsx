import { useState } from 'react'
import brandLockup from './assets/logo-lockup.svg'
import { downloadSectionsPdf, logoForPdf } from './documentPdf'
import './LegalPages.css'

interface LegalSection {
  id: string
  title: string
  paragraphs?: string[]
  bullets?: string[]
  steps?: string[]
  note?: string
}

const guideSections: LegalSection[] = [
  {
    id: 'presentation',
    title: '1. Présentation du portail',
    paragraphs: [
      'Le portail du transport de la commune urbaine d’Antsirabe centralise le registre des cyclo-pousses, bus et bajaj, les propriétaires, les conducteurs, les visites médicales, les vignettes, les signalements et la carte du réseau.',
      'Il existe trois espaces distincts : le portail public (usagers), l’espace des agents contrôleurs et le portail d’administration. Chaque espace n’affiche que les fonctions autorisées par le rôle du compte connecté.',
    ],
    bullets: [
      'Portail public : vérifier un véhicule avec son QR code ou son immatriculation, signaler un problème.',
      'Espace contrôleur : consulter les véhicules, les conducteurs, les signalements et créer des rapports.',
      'Portail administrateur : gérer l’ensemble des données, les comptes, les imports, les statistiques et les documents.',
    ],
  },
  {
    id: 'connexion',
    title: '2. Connexion et sécurité du compte',
    steps: [
      'Ouvrez l’adresse du portail. Sur l’écran de connexion, saisissez votre adresse e-mail professionnelle et votre mot de passe.',
      'Choisissez la langue (malgache, français, anglais) et le thème jour ou nuit depuis le sélecteur en haut de l’écran.',
      'Après huit heures, la session expire automatiquement : reconnectez-vous pour continuer.',
      'En cas d’oubli, cliquez sur « Mot de passe oublié ? » et envoyez la demande. L’administrateur la traite dans « Demandes mot de passe ».',
    ],
    bullets: [
      'Utilisez un mot de passe unique d’au moins 8 caractères, avec majuscules, chiffres et symboles.',
      'Ne partagez jamais votre compte : chaque action est enregistrée dans l’historique.',
      'Après huit échecs de connexion, l’accès est temporairement bloqué pendant 15 minutes.',
      'Après 30 minutes sans activité, la session est fermée automatiquement ; un avertissement s’affiche deux minutes avant.',
      'Cliquez sur la flèche de déconnexion en bas du menu pour fermer la session sur un poste partagé.',
    ],
  },
  {
    id: 'navigation',
    title: '3. Navigation générale',
    bullets: [
      'Le menu latéral est organisé en quatre groupes : Espace de travail, Gestion, Suivi et Administration.',
      'Le bouton ☰ ouvre le menu sur téléphone et tablette.',
      'La barre supérieure affiche la date du jour, la météo locale, le sélecteur de langue, le thème et les notifications.',
      'Chaque liste propose une vue tableau (☷) et une vue mosaïque (▦) ; votre choix est conservé pendant la session.',
      'Le champ de recherche filtre immédiatement les lignes ; les filtres complémentaires dépendent de la page.',
    ],
  },
  {
    id: 'vehicules',
    title: '4. Gérer les véhicules',
    steps: [
      'Ouvrez « Tous les transports », puis filtrez par type : cyclo-pousse, bus ou bajaj.',
      'Utilisez « Ajouter un véhicule » pour créer une fiche. Les champs obligatoires sont signalés.',
      'Sélectionnez une ligne pour ouvrir le détail, modifier la fiche ou supprimer l’enregistrement.',
      'Dans la fiche, la photo du véhicule et celle du propriétaire peuvent être ajoutées, remplacées ou supprimées.',
      'Les vignettes et l’impôt synthétique du propriétaire sont affichés dans le bloc de conformité.',
    ],
    bullets: [
      'La recherche accepte l’immatriculation, le nom du véhicule, le propriétaire ou l’adresse.',
      'Le tri fonctionne sur l’immatriculation, la date d’ajout, le propriétaire, l’adresse et le type.',
      'La sélection multiple permet d’imprimer les QR codes de plusieurs véhicules en une fois.',
    ],
  },
  {
    id: 'qr',
    title: '5. Imprimer les QR codes',
    steps: [
      'Sur la page « Tous les transports », cochez un ou plusieurs véhicules, puis cliquez sur « Imprimer QR ».',
      'Chaque planche A4 contient exactement 6 autocollants (2 colonnes × 3 lignes).',
      'Le bas de chaque autocollant affiche l’immatriculation du véhicule, alignée à droite.',
      'Utilisez « Imprimer » pour le papier ou « Télécharger le PDF » pour archiver la planche.',
    ],
    note: 'Vérifiez l’aperçu avant impression : l’échelle doit rester à 100 % et les marges doivent être nulles pour conserver 6 codes par page.',
  },
  {
    id: 'conducteurs',
    title: '6. Conducteurs et visites médicales',
    bullets: [
      'La page « Conducteurs » liste les titulaires et les remplaçants, avec leur véhicule et leur rôle.',
      'La fiche conducteur permet de mettre à jour l’identité, le permis, la photo et le véhicule affecté.',
      '« Visites médicales » enregistre une visite, sa durée (1, 3, 6 ou 12 mois) et sa date d’expiration.',
      'Les visites arrivant à échéance génèrent automatiquement une notification pour l’administration.',
    ],
  },
  {
    id: 'paiements',
    title: '7. Vignettes et paiements',
    steps: [
      'Ouvrez « Paiements vignette » puis « Nouveau paiement ».',
      'Renseignez l’immatriculation, le montant, la date, la référence et l’observation éventuelle.',
      'Le paiement valide la vignette pour un an à compter de la date d’encaissement.',
      'Depuis le détail, imprimez le reçu 58 mm ou 80 mm, ou téléchargez-le en PDF.',
      'Le rapport de caisse se filtre par jour, mois, année ou toute la période, puis s’exporte en CSV ou en PDF.',
    ],
  },
  {
    id: 'signalements',
    title: '8. Signalements et rapports',
    bullets: [
      'Un signalement peut être créé par un usager (portail public), un contrôleur ou un administrateur.',
      'Depuis la page d’accueil publique, le formulaire « Envoyer un rapport à la commune » transmet une observation libre (objet, message, nom et e-mail facultatifs) à l’administration, qui la reçoit dans ses notifications.',
      'Il contient l’immatriculation, le motif, une description, la date et le statut (Nouveau, En cours, Traité).',
      'L’administrateur change le statut depuis la liste ; chaque changement est tracé.',
      'La page « Rapports » permet de rédiger une synthèse, de sélectionner plusieurs rapports et de générer un PDF paysage.',
    ],
  },
  {
    id: 'carte',
    title: '9. Carte du réseau',
    bullets: [
      'Affichez ou masquez les véhicules et les scans avec les boutons de couches.',
      'Basculez entre le fond Plan et Satellite, et entre la vue 2D et 3D.',
      'Les modes Jour et Nuit s’adaptent automatiquement à l’heure ; vous pouvez forcer un mode.',
      'Cliquez sur un marqueur ou sur une ligne de la liste paginée pour ouvrir la fiche détaillée.',
      'Le bouton « Mettre à jour avec ma position » enregistre la position GPS du véhicule sélectionné.',
      'La légende indique la couleur de chaque type de transport et des scans.',
    ],
  },
  {
    id: 'statistiques',
    title: '10. Statistiques et propriétaires',
    bullets: [
      'Les statistiques présentent les volumes, les signalements par mois, les recettes de vignettes et la répartition par type.',
      'Les graphiques courbe et anneau se mettent à jour à chaque chargement.',
      'Le suivi de l’impôt synthétique indique les propriétaires avec NIF, les paiements de l’année et les retards.',
      'Le renouvellement annuel de l’impôt synthétique intervient le 30 mars de chaque année.',
      'Le rapport de statistiques se télécharge en PDF avec le logo de la commune.',
    ],
  },
  {
    id: 'comptes',
    title: '11. Comptes et permissions',
    bullets: [
      'Le portail accepte au maximum 3 administrateurs (vous inclus) et 40 contrôleurs.',
      'Un administrateur ne peut pas supprimer un autre administrateur et personne ne peut modifier son propre rôle.',
      'La création d’un compte contrôleur nécessite un nom, un e-mail et un mot de passe initial de 6 caractères minimum.',
      'La promotion d’un contrôleur en administrateur est possible tant que la limite de 3 n’est pas atteinte.',
      'Les demandes de réinitialisation sont approuvées avec un mot de passe temporaire que l’agent doit changer.',
    ],
  },
  {
    id: 'imports',
    title: '12. Imports de données',
    steps: [
      'Ouvrez « Imports » et choisissez « Conducteurs » ou « Photos des véhicules ».',
      'Lancez toujours une simulation avant l’import réel pour contrôler le nombre de lignes concernées.',
      'L’import des conducteurs ajoute les profils et visites manquants sans dupliquer les entrées reconnues.',
      'La liaison des photos associe les fichiers présents dans le dossier PhotoCycloPousses aux immatriculations correspondantes.',
      'Chaque import est transactionnel : en cas d’erreur, aucune modification partielle n’est conservée.',
    ],
  },
  {
    id: 'documents',
    title: '13. Impression et téléchargement',
    bullets: [
      'Tous les documents imprimables disposent d’une version PDF téléchargeable.',
      'Reçus de vignette : formats 58 mm et 80 mm.',
      'Rapports : synthèse de sélection ou rapport complet en orientation paysage.',
      'Statistiques : rapport A4 avec logo, indicateurs et tableaux.',
      'QR codes : fiche individuelle ou planche de 6 autocollants par page A4.',
    ],
  },
  {
    id: 'depannage',
    title: '14. Dépannage rapide',
    bullets: [
      '« Session expirée » : reconnectez-vous, la session dure huit heures.',
      '« Accès refusé » : la fonction est réservée à un autre rôle ou votre compte a changé de rôle.',
      'La carte ne s’affiche pas : vérifiez la connexion Internet, les tuiles sont chargées en ligne.',
      'Une photo est refusée : utilisez JPG, PNG, WebP ou GIF, 12 Mo maximum.',
      'Un PDF ne se télécharge pas : autorisez les téléchargements et les fenêtres surgissantes pour le portail.',
      'En cas de doute, contactez l’administrateur système de la commune.',
    ],
  },
]

const privacySections: LegalSection[] = [
  {
    id: 'responsable',
    title: '1. Responsable du traitement',
    paragraphs: [
      'Le responsable du traitement est la Commune urbaine d’Antsirabe, à travers le service en charge du transport urbain.',
      'Le portail est exploité pour la gestion du registre des transports (cyclo-pousses, bus et bajaj), le contrôle des vignettes, le suivi médical des conducteurs, la sécurité des usagers et la statistique municipale.',
    ],
  },
  {
    id: 'donnees',
    title: '2. Données collectées',
    bullets: [
      'Identification des propriétaires : nom, prénom, date et lieu de naissance, CIN, adresse, téléphone, profession, NIF.',
      'Identification des conducteurs : nom, prénom, CIN, permis, adresse, photo et suivi des visites médicales.',
      'Véhicules : immatriculation, type, couleur, coopérative, photo, position GPS, statut et vignette.',
      'Paiements : montant, date, référence, observation et agent encaisseur.',
      'Signalements : immatriculation, motif, description, date et statut. Aucune identité d’auteur n’est enregistrée pour les signalements publics.',
      'Données techniques : adresse IP, date et position approximative lors d’un scan public, journaux de connexion et historique des modifications.',
    ],
  },
  {
    id: 'finalites',
    title: '3. Finalités et base légale',
    bullets: [
      'Gérer et vérifier la régularité des véhicules de transport urbain.',
      'Assurer la traçabilité des paiements de vignette et de l’impôt synthétique.',
      'Protéger la santé des conducteurs et la sécurité des passagers.',
      'Traiter les signalements des usagers et améliorer le service public.',
      'Produire des statistiques agrégées pour la commune.',
      'Sécuriser les accès et prévenir la fraude.',
    ],
    note: 'Les traitements reposent sur l’exécution d’une mission de service public, le respect d’obligations légales et, lorsque nécessaire, le consentement de la personne concernée, conformément à la loi malgache n° 2014-038 relative à la protection des données à caractère personnel.',
  },
  {
    id: 'conservation',
    title: '4. Durée de conservation',
    bullets: [
      'Données des véhicules, propriétaires et conducteurs : pendant la durée d’activité, puis archivage selon les obligations communales.',
      'Paiements et pièces comptables : durée légale de conservation comptable.',
      'Signalements : trois ans après leur clôture.',
      'Journaux de sécurité et historique : douze mois glissants, sauf enquête en cours.',
      'Demandes de réinitialisation : trois mois après traitement.',
    ],
  },
  {
    id: 'partage',
    title: '5. Destinataires et partage',
    bullets: [
      'Les agents habilités de la commune (administrateurs et contrôleurs) accèdent aux données selon leur rôle.',
      'Les prestataires techniques (hébergement, base de données) interviennent comme sous-traitants, avec des engagements de confidentialité.',
      'Les autorités compétentes peuvent recevoir des données sur réquisition légale.',
      'Aucune donnée n’est vendue ni cédée à des fins commerciales.',
    ],
  },
  {
    id: 'securite',
    title: '6. Mesures de sécurité',
    bullets: [
      'Mots de passe stockés sous forme de hachage bcrypt et jamais affichés en clair.',
      'Session par cookie httpOnly, SameSite et Secure en production, expiration après huit heures.',
      'Limitation du nombre de tentatives de connexion et blocage temporaire en cas de force brute.',
      'Contrôle du rôle à chaque requête et révocation immédiate des comptes supprimés ou rétrogradés.',
      'Validation des fichiers envoyés (type réel de l’image et taille maximale).',
      'Journalisation des opérations sensibles et sauvegardes régulières de la base.',
      'Chiffrement des échanges HTTPS en production et en-têtes de sécurité stricts.',
      'Cookie de session httpOnly, fermeture automatique après 30 minutes d’inactivité et limitation du débit des requêtes sensibles.',
    ],
  },
  {
    id: 'cookies',
    title: '7. Cookies et stockage local',
    bullets: [
      'Un cookie de session strictement nécessaire est utilisé pour maintenir la connexion des agents.',
      'Le portail public ne dépose aucun cookie publicitaire ni traceur commercial.',
      'La langue et le thème choisis sont conservés dans le stockage local du navigateur.',
      'Vous pouvez supprimer ces préférences en effaçant les données du site dans votre navigateur.',
    ],
  },
  {
    id: 'droits',
    title: '8. Vos droits',
    paragraphs: [
      'Toute personne concernée peut demander l’accès à ses données, leur rectification, leur effacement lorsqu’il est compatible avec les obligations légales, la limitation du traitement ou s’opposer à un usage non nécessaire.',
      'Les demandes sont adressées au service du transport de la Commune urbaine d’Antsirabe, avec une pièce d’identité permettant de vérifier l’identité du demandeur. Une réponse est apportée dans un délai raisonnable, généralement sous trente jours.',
      'En cas de désaccord, la personne peut saisir l’autorité de contrôle compétente en matière de protection des données à Madagascar.',
    ],
  },
  {
    id: 'mineurs',
    title: '9. Données des mineurs',
    paragraphs: [
      'Le registre ne collecte pas sciemment de données concernant des mineurs. Si une telle donnée est nécessaire à la gestion d’un dossier, l’accord du représentant légal est requis.',
    ],
  },
  {
    id: 'incidents',
    title: '10. Incident de sécurité',
    paragraphs: [
      'En cas de violation de données susceptible d’engendrer un risque élevé pour les personnes, la commune informe l’autorité compétente et les personnes concernées dans les meilleurs délais, en décrivant la nature de l’incident et les mesures prises.',
    ],
  },
  {
    id: 'mise-a-jour',
    title: '11. Mise à jour de cette politique',
    paragraphs: [
      'Cette politique peut évoluer avec le portail ou la réglementation. La date de dernière mise à jour est affichée en tête du document. La version publiée sur le portail prévaut.',
      'Dernière mise à jour : 16 novembre 2026.',
    ],
  },
  {
    id: 'contact',
    title: '12. Contact',
    paragraphs: [
      'Commune urbaine d’Antsirabe — Service du transport urbain.',
      'Adresse : Hôtel de ville, Antsirabe, Madagascar.',
      'Pour toute question relative à vos données : contactez l’administrateur du portail ou le guichet du service transport.',
    ],
  },
]

type LegalKind = 'guide' | 'privacy'

const documents: Record<
  LegalKind,
  {
    eyebrow: string
    title: string
    lead: string
    sections: LegalSection[]
    file: string
    summary: string[]
  }
> = {
  guide: {
    eyebrow: 'DOCUMENTATION · COMMUNAUTÉ',
    title: 'Guide d’utilisation',
    lead:
      'Tout ce qu’il faut savoir pour utiliser le portail du transport de commune urbaine d’Antsirabe : connexion, gestion des véhicules, QR codes, carte, paiements, rapports, statistiques et dépannage.',
    sections: guideSections,
    file: 'Guide_utilisation_Transport_Antsirabe.pdf',
    summary: [
      'Version 1.0 — 16 novembre 2026',
      'Public : administrateurs, contrôleurs et usagers',
      'Portail : transport de la commune urbaine d’Antsirabe',
    ],
  },
  privacy: {
    eyebrow: 'CONFIDENTIALITÉ · DONNÉES PERSONNELLES',
    title: 'Politique de confidentialité',
    lead:
      'La commune traite les données du registre des transports avec exigence et transparence. Cette politique décrit les données collectées, leur finalité, leur durée de conservation, les mesures de sécurité et vos droits.',
    sections: privacySections,
    file: 'Politique_confidentialite_Transport_Antsirabe.pdf',
    summary: [
      'Version 1.0 — 16 novembre 2026',
      'Référence : loi malgache n° 2014-038',
      'Responsable : Commune urbaine d’Antsirabe',
    ],
  },
}

function LegalDocument({ kind, onBack }: { kind: LegalKind; onBack?: () => void }) {
  const document = documents[kind]
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function downloadPdf() {
    setBusy(true)
    setError('')
    try {
      await downloadSectionsPdf({
        filename: document.file,
        title: document.title,
        subtitle: 'Commune urbaine d’Antsirabe — Service du transport urbain',
        summary: document.summary,
        sections: document.sections.map((section) => ({
          heading: section.title,
          headers: ['Contenu'],
          rows: [
            ...(section.paragraphs ?? []).map((paragraph) => [paragraph]),
            ...(section.bullets ?? []).map((bullet) => [`• ${bullet}`]),
            ...(section.steps ?? []).map((step, index) => [`${index + 1}. ${step}`]),
            ...(section.note ? [[`À retenir : ${section.note}`]] : []),
          ],
        })),
        logo: await logoForPdf(brandLockup),
      })
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Téléchargement du document impossible.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="legal-page" id={kind}>
      <header className="legal-hero">
        <img className="legal-hero__logo" src={brandLockup} alt="Transport de commune urbaine Antsirabe" />
        <div className="legal-hero__copy">
          <span className="legal-eyebrow">{document.eyebrow}</span>
          <h1>{document.title}</h1>
          <p>{document.lead}</p>
          <div className="legal-actions">
            {onBack && (
              <button type="button" className="button secondary" onClick={onBack}>
                ← Retour au portail
              </button>
            )}
            <button type="button" className="button primary" onClick={() => void downloadPdf()} disabled={busy}>
              {busy ? 'Génération…' : 'Télécharger le PDF'}
            </button>
            <button type="button" className="button secondary" onClick={() => window.print()}>
              Imprimer
            </button>
          </div>
          {error && <p className="legal-error" role="alert">{error}</p>}
        </div>
      </header>

      <div className="legal-layout">
        <nav className="legal-toc" aria-label="Sommaire">
          <p className="legal-toc__title">Sommaire</p>
          <ol>
            {document.sections.map((section) => (
              <li key={section.id}>
                <a href={`#${kind}-${section.id}`}>{section.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="legal-content">
          {document.sections.map((section) => (
            <section className="legal-section" id={`${kind}-${section.id}`} key={section.id}>
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets && (
                <ul>
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
              {section.steps && (
                <ol className="legal-steps">
                  {section.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              )}
              {section.note && <p className="legal-note">{section.note}</p>}
            </section>
          ))}
          <footer className="legal-foot">
            <img src={brandLockup} alt="" />
            <p>
              Transport de la commune urbaine d’Antsirabe · Madagascar.
              <br />
              Document généré le {new Date().toLocaleDateString('fr-FR')}. La version publiée sur le portail prévaut.
            </p>
          </footer>
        </div>
      </div>
    </article>
  )
}

export function UserGuidePage({ onBack }: { onBack?: () => void }) {
  return <LegalDocument kind="guide" onBack={onBack} />
}

export function PrivacyPolicyPage({ onBack }: { onBack?: () => void }) {
  return <LegalDocument kind="privacy" onBack={onBack} />
}
