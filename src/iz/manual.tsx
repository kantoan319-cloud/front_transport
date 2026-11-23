import { PageHead, useApp } from './components'

interface Section {
  title: string
  points: string[]
}

const SHARED: Section[] = [
  {
    title: 'Connexion et navigation',
    points: [
      'Ouvrez le site puis cliquez sur « Connexion ». Saisissez l’adresse e-mail et le mot de passe fournis par l’administration.',
      'L’icône en forme d’œil, à droite du mot de passe, affiche ou masque la saisie pour éviter les erreurs.',
      'Le menu latéral (ou le bouton ☰ sur téléphone) donne accès à toutes vos rubriques. Le lien « ← Accueil » ramène au site public.',
      'Le bouton de déconnexion se trouve en haut à droite, dans le menu de votre compte. Déconnectez-vous toujours sur un appareil partagé.',
      'La même application est installable sur Android depuis la page d’accueil (bouton de téléchargement de l’APK).',
    ],
  },
]

const CONTROLEUR: Section[] = [
  {
    title: 'Scanner et contrôler un véhicule',
    points: [
      'Rubrique « Scan / contrôle » : scannez le QR code du bus avec l’appareil photo, ou saisissez l’immatriculation à la main.',
      'La fiche affiche le statut du véhicule, la licence, le propriétaire et la photo du véhicule. La photo du propriétaire est réservée aux agents habilités (contrôleur, admin, superadmin).',
      'Enregistrez le contrôle : le résultat (conforme ou non conforme) et la position sont horodatés dans l’historique des scans.',
    ],
  },
  {
    title: 'Traitement des signalements',
    points: [
      'Rubrique « Signalements » : chaque signalement contient la position GPS de l’auteur, la photo éventuelle et le statut.',
      'Ouvrez un signalement pour le traiter (prise en charge, résolution) ou le supprimer si nécessaire.',
      'La carte « Suivre un signalement » affiche la position exacte transmise par l’usager.',
    ],
  },
  {
    title: 'Infractions et fourrière',
    points: [
      'Rubrique « Infractions » : créez une infraction depuis un contrôle, précisez le type et le montant, puis suivez son statut.',
      'Rubrique « Fourrière » : mettez un véhicule en fourrière avec un motif, puis enregistrez sa sortie après régularisation.',
    ],
  },
  {
    title: 'Faire un signalement vous-même',
    points: [
      'Rubrique « Faire un signalement » : la position GPS est obligatoire. Sans localisation autorisée, l’envoi est refusé.',
      'Autorisez la localisation dans le navigateur ou l’application, puis utilisez « Joindre ma position maintenant » si besoin.',
      'Conservez la référence obtenue pour suivre l’avancement.',
    ],
  },
]

const ADMIN: Section[] = [
  {
    title: 'Tableau de bord et données',
    points: [
      'Le tableau de bord synthétise les véhicules, coopératives, propriétaires, signalements, scans et infractions.',
      '« Données décisionnelles » propose les analyses et rapports imprimables (avec logo de la commune).',
    ],
  },
  {
    title: 'Gestion des véhicules',
    points: [
      'Trois affichages sont disponibles : liste, mosaïque et « Par ligne » (regroupement automatique par ligne, ex. Ligne 12 · n bus).',
      'Recherchez, triez et paginez la liste. Chaque fiche véhicule accepte une photo du véhicule, visible par tous les visiteurs.',
      'La photo du propriétaire est visible uniquement par le contrôleur, l’admin et le superadmin.',
      'Licences : date de début et de fin (6 mois), NIF, numéro. La liste « Licences expirées » permet de renouveler un véhicule.',
    ],
  },
  {
    title: 'Propriétaires, coopératives et lignes',
    points: [
      'Rubrique « Propriétaires » : créez ou modifiez un propriétaire (nom, téléphone, coopérative, photo). Les modifications sont enregistrées immédiatement.',
      'Rubrique « Coopératives » : ajoutez une coopérative avec son code, son nom et ses lignes.',
      'Rubrique « Lignes » : chaque ligne possède sa propre couleur, appliquée automatiquement aux tracés et aux arrêts sur la carte. Les arrêts se gèrent ligne par ligne.',
    ],
  },
  {
    title: 'Capacité et receveur',
    points: [
      'Rubrique « Capacité & receveur » : deux onglets listent les attestations de capacité et de receveur importées.',
      'Recherchez un titulaire, un numéro d’attestation, un CIN ou un bus. Filtrez par statut ou sur les attestations non liées.',
      'Bouton « Lier à un bus » : choisissez le bus dans la liste, puis enregistrez. Un bus ne porte qu’une attestation de chaque type : une nouvelle liaison remplace l’ancienne.',
      '« Détails » affiche toutes les informations de l’attestation. « Délier » retire la liaison sans supprimer l’attestation.',
      'La fiche d’un bus affiche aux administrateurs les attestations de capacité et de receveur qui lui sont liées.',
    ],
  },
  {
    title: 'Paiements et reçus',
    points: [
      'Rubrique « Paiements » : enregistrez un paiement (type, montant, moyen) et suivez sa validation.',
      'Le registre des paiements se consulte par jour, mois ou année, avec impression et export PDF. Le reçu est en noir et blanc, avec logo de la commune, nom du propriétaire, immatriculation et date/heure.',
      'Chaque liste peut être exportée en Excel via le bouton d’export.',
    ],
  },
  {
    title: 'Comptes et historique',
    points: [
      'Rubrique « Utilisateurs » : créez des contrôleurs et des administrateurs. Limites : 5 administrateurs et 100 contrôleurs.',
      'Un admin ne peut pas supprimer un autre admin ; il peut gérer les contrôleurs. Le superadmin peut tout gérer.',
      '« Historique » liste les actions des contrôleurs (pour un admin). Chaque action importante (création, modification, suppression) est tracée.',
    ],
  },
]

const SUPERADMIN: Section[] = [
  {
    title: 'Droits du super administrateur',
    points: [
      'Le superadmin peut gérer tous les comptes, y compris les administrateurs, et supprimer n’importe quelle donnée.',
      'Il consulte l’historique des actions des administrateurs (rubrique « Historique des administrateurs »).',
      'Le registre des paiements permet la suppression d’un paiement, y compris validé.',
      'L’adresse e-mail et le mot de passe du compte super administrateur peuvent être modifiés depuis le profil.',
    ],
  },
]

export function ManualPage({ scope }: { scope: 'controle' | 'admin' }) {
  const { user } = useApp()
  const isSuper = user?.role === 'superadmin'
  const sections = scope === 'controle'
    ? CONTROLEUR
    : [...ADMIN, ...(isSuper ? SUPERADMIN : [])]

  return (
    <>
      <PageHead
        title="Manuel d’utilisation"
        subtitle={scope === 'controle' ? 'Guide des agents de contrôle' : 'Guide de l’administration'}
        action={<button className="iz-btn iz-btn-outline iz-no-print" onClick={() => window.print()}>Imprimer le manuel</button>}      />
      <div className="iz-printable">
        <div className="iz-print-head">
          <img src="/brand/logo-commune.png" alt="Commune Urbaine d’Antsirabe" />
          <div>
            <strong>Commune Urbaine d’Antsirabe — iZOTRA</strong>
            <span>Manuel d’utilisation {scope === 'controle' ? 'des agents de contrôle' : 'de l’administration'}</span>
            <span>{new Date().toLocaleDateString('fr-FR')}</span>
          </div>
        </div>

        <div className="iz-manual">
          {[...SHARED, ...sections].map((section) => (
            <section className="iz-manual-section" key={section.title}>
              <h2>{section.title}</h2>
              <ul>
                {section.points.map((point) => <li key={point}>{point}</li>)}
              </ul>
            </section>
          ))}
          <section className="iz-manual-section">
            <h2>En cas de problème</h2>
            <ul>
              <li>Si une page ne se charge pas, vérifiez la connexion Internet puis rechargez.</li>
              <li>Si vos droits semblent insuffisants, contactez le super administrateur pour vérifier votre rôle.</li>
              <li>Ne partagez jamais votre mot de passe. En cas de doute, changez-le depuis votre profil.</li>
            </ul>
          </section>
        </div>
      </div>
    </>
  )
}
