import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';

type Section =
  | 'overview'
  | 'annonces'
  | 'matching'
  | 'messages'
  | 'logistique'
  | 'inventaire'
  | 'admin'
  | 'profile'
  | 'diagnostic';

interface Coordonnees {
  latitude: number;
  longitude: number;
}

interface Utilisateur {
  id?: string;
  _id?: string;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  role: string;
  adresse?: string;
  localisation?: Coordonnees;
  statutCompte?: string;
  categorieAssociation?: string;
  createdAt?: string;
}

interface Categorie {
  _id: string;
  nom: string;
  description?: string;
  typeProduit: string;
  prioriteRedistribution: string;
  dureeConservationEstimee: number;
}

interface Annonce {
  _id: string;
  auteur: Utilisateur;
  type: 'OFFRE' | 'DEMANDE';
  titre: string;
  description: string;
  categorieDonation: Categorie;
  quantiteEstimee: number;
  unite: string;
  urgence: string;
  adresse: string;
  localisation: Coordonnees;
  dateExpiration: string;
  statut: string;
  createdAt: string;
}

interface Suggestion {
  monAnnonce: { id: string; titre: string; type: string };
  annonceCompatible: {
    id: string;
    titre: string;
    type: string;
    auteur: Utilisateur;
  };
  score: number;
  criteres: Record<string, number>;
  distanceKm: number;
}

interface Matching {
  _id: string;
  offre: Pick<Annonce, '_id' | 'titre' | 'type' | 'quantiteEstimee' | 'unite'>;
  demande: Pick<Annonce, '_id' | 'titre' | 'type' | 'quantiteEstimee' | 'unite'>;
  score: number;
  distanceKm: number;
  statut: string;
  criteres: Record<string, number>;
}

interface Conversation {
  _id: string;
  participants: Utilisateur[];
  annonce: Pick<Annonce, '_id' | 'titre' | 'type' | 'statut'>;
  statut: string;
  dernierMessageAt?: string;
}

interface Message {
  _id: string;
  expediteur: Utilisateur;
  contenu: string;
  createdAt: string;
  luPar: string[];
}

interface Partie {
  _id: string;
  nom: string;
  prenom: string;
  telephone?: string;
  adresse?: string;
}

interface Donation {
  _id: string;
  titre: string;
  description?: string;
  fournisseur?: Utilisateur;
  beneficiaire?: Utilisateur | null;
  categorieDonation?: Categorie;
  compositionLot?: string;
  quantiteEstimee?: number;
  unite?: string;
  poidsTotalKg: number;
  images?: string[];
  temperatureStockage?: number | null;
  conditionsStockage?: string;
  statut?: string;
  urgence: string;
  dateDisponibilite?: string;
  dateLimiteCollecte?: string;
  adresseCollecte?: string;
  localisationCollecte?: { latitude: number; longitude: number };
  createdAt?: string;
}

interface Collecte {
  _id: string;
  reference: string;
  statut: string;
  priorite: string;
  donation: Donation;
  transporteur: Partie | null;
  fournisseur: Partie;
  beneficiaire: Partie;
  adresseDepart: string;
  adresseArrivee: string;
  distanceKm: number;
  dureeEstimeeMinutes: number;
  dateCollectePrevue: string;
  dateLivraisonPrevue?: string;
  vehicule?: string;
  prochainsStatuts: string[];
}

interface PointCarte {
  id: string;
  reference: string;
  titre: string;
  statut: string;
  depart: Coordonnees & { adresse: string };
  arrivee: Coordonnees & { adresse: string };
  positionActuelle?: Coordonnees;
  transporteur: string | null;
}

interface DashboardLogistique {
  kpis: {
    collectesTotal: number;
    collectesActives: number;
    livraisonsTerminees: number;
    poidsLivreKg: number;
    dureeMoyenneMinutes: number;
    tauxPonctualite: number;
  };
  parStatut: Record<string, number>;
  activite: Array<{ date: string; livraisons: number }>;
  alertes: Array<{
    id: string;
    niveau: string;
    titre: string;
    message: string;
  }>;
}

interface Transporteur extends Partie {
  collectesActives: number;
}

interface RisqueRetard {
  collecteId: string;
  reference: string;
  analyse: {
    score: number;
    pourcentage: number;
    niveau: 'FAIBLE' | 'ATTENTION' | 'CRITIQUE';
    margeMinutes: number | null;
    raisons: string[];
  };
}

interface ItineraireIA {
  transporteur: { id: string; nom: string };
  distanceInitialeKm: number;
  distanceOptimiseeKm: number;
  gainDistanceKm: number;
  dureeEstimeeMinutes: number;
  ordreOptimise: Array<{
    ordre: number;
    collecteId: string;
    reference: string;
    titre: string;
    score: number;
    distanceApprocheKm: number;
  }>;
}

interface RecommandationTransporteur {
  transporteur: {
    id: string;
    nom: string;
    email: string;
    telephone: string;
  };
  score: number;
  pourcentage: number;
  distanceKm: number;
  raisons: string[];
}

interface DashboardAdmin {
  utilisateurs: {
    total: number;
    parRole: Array<{ _id: string; total: number }>;
    parStatut: Array<{ _id: string; total: number }>;
  };
  donations: number;
  annonces: number;
  collectes: number;
}

interface CompteDemo {
  role: string;
  label: string;
  email: string;
  description: string;
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private map?: L.Map;
  private suggestionTimeout?: ReturnType<typeof setTimeout>;
  private markers?: L.LayerGroup;
  private mapElement?: HTMLDivElement;

  protected readonly comptesDemo: CompteDemo[] = [
    {
      role: 'ADMIN',
      label: 'Administrateur',
      email: 'admin@rescuefood.demo',
      description: 'Utilisateurs, logistique et statistiques globales'
    },
    {
      role: 'FOURNISSEUR',
      label: 'Fournisseur',
      email: 'marche.centre@rescuefood.demo',
      description: 'Offres, suggestions et conversations'
    },
    {
      role: 'ONG',
      label: 'ONG',
      email: 'solidarite@rescuefood.demo',
      description: 'Demandes, matching et suivi des collectes'
    },
    {
      role: 'TRANSPORTEUR',
      label: 'Transporteur',
      email: 'transport@rescuefood.demo',
      description: 'Missions, statuts et suivi GPS'
    },
    {
      role: 'CITOYEN',
      label: 'Citoyen',
      email: 'citoyen@rescuefood.demo',
      description: 'Consultation publique des annonces'
    }
  ];

  protected readonly section = signal<Section>('overview');
  protected readonly vueAuth = signal<'connexion' | 'inscription' | 'connexion-ong'>('connexion');
  protected readonly email = signal('admin@rescuefood.demo');
  protected readonly motDePasse = signal('Demo1234!');
  protected readonly utilisateur = signal<Utilisateur | null>(null);
  protected readonly chargement = signal(false);
  protected readonly chargementConnexion = signal(false);
  protected readonly chargementInscription = signal(false);
  protected readonly inscriptionSucces = signal('');
  protected readonly erreur = signal('');
  protected readonly succes = signal('');

  protected readonly registerForm = {
    nom: '',
    prenom: '',
    email: '',
    motDePasse: '',
    telephone: '',
    role: 'FOURNISSEUR',
    adresse: '',
    categorieAssociation: 'HUMANITAIRE'
  };

  protected readonly categoriesAssociation = [
    { value: 'HUMANITAIRE', label: 'Association humanitaire', emoji: '🤝' },
    { value: 'ANIMAUX',     label: 'Protection des animaux', emoji: '🐾' },
    { value: 'ALIMENTAIRE', label: 'Aide alimentaire',        emoji: '🍽️' },
    { value: 'EDUCATION',   label: 'Éducation & jeunesse',   emoji: '📚' },
    { value: 'SANTE',       label: 'Santé & bien-être',      emoji: '❤️' },
    { value: 'LOGEMENT',    label: 'Logement & hébergement', emoji: '🏠' },
    { value: 'ENVIRONNEMENT',label: 'Environnement',         emoji: '🌱' },
    { value: 'AUTRE',       label: 'Autre',                  emoji: '🌍' }
  ];

  protected readonly rolesInscription = [
    { value: 'FOURNISSEUR', label: 'Fournisseur', hint: 'Surplus à donner' },
    { value: 'ONG', label: 'Association', hint: 'Besoin de dons' },
    { value: 'TRANSPORTEUR', label: 'Transporteur', hint: 'Livraisons' },
    { value: 'CITOYEN', label: 'Citoyen', hint: 'Consultation' }
  ];

  protected readonly categories = signal<Categorie[]>([]);
  protected readonly annonces = signal<Annonce[]>([]);
  protected readonly mesAnnonces = signal<Annonce[]>([]);
  protected readonly suggestions = signal<Suggestion[]>([]);
  protected readonly matchings = signal<Matching[]>([]);
  protected readonly conversations = signal<Conversation[]>([]);
  protected readonly messages = signal<Message[]>([]);
  protected readonly conversationSelectionnee = signal<Conversation | null>(null);
  protected readonly nouveauMessage = signal('');
  protected readonly filtreAnnonce = signal<'TOUS' | 'OFFRE' | 'DEMANDE'>('TOUS');
  protected readonly rechercheAnnonce = signal('');
  protected readonly formulaireAnnonceOuvert = signal(false);
  protected readonly annonceEnEdition = signal<Annonce | null>(null);
  protected readonly annonceForm = {
    titre: '',
    description: '',
    categorieDonation: '',
    quantiteEstimee: 10,
    unite: 'KG',
    urgence: 'MOYENNE',
    adresse: '',
    latitude: 36.8065,
    longitude: 10.1815,
    dateExpiration: ''
  };

  protected readonly collectes = signal<Collecte[]>([]);
  protected readonly pointsCarte = signal<PointCarte[]>([]);
  protected readonly transporteurs = signal<Transporteur[]>([]);
  protected readonly collecteSelectionnee = signal<Collecte | null>(null);
  protected readonly transporteurSelectionne = signal('');
  protected readonly vehicule = signal('');
  protected readonly filtreStatut = signal('TOUS');
  protected readonly rechercheCollecte = signal('');
  protected readonly risquesRetard = signal<Record<string, RisqueRetard>>({});
  protected readonly itineraireIA = signal<ItineraireIA | null>(null);
  protected readonly optimisationEnCours = signal(false);
  protected readonly transporteurIASelectionne = signal('');
  protected readonly recommandationsTransporteurs =
    signal<RecommandationTransporteur[]>([]);
  protected readonly dashboardLogistique = signal<DashboardLogistique>(
    this.dashboardLogistiqueVide()
  );

  protected readonly donations = signal<Donation[]>([]);
  protected readonly filtreDonationStatut = signal('TOUS');
  protected readonly filtreDonationUrgence = signal('TOUS');
  protected readonly formulaireDonationOuvert = signal(false);
  protected readonly donationEnEdition = signal<Donation | null>(null);
  protected readonly donationForm = {
    titre: '',
    description: '',
    categorieDonation: '',
    compositionLot: '',
    quantiteEstimee: 10,
    unite: 'KG',
    poidsTotalKg: 0,
    imageUrl: '',
    temperatureStockage: '',
    conditionsStockage: '',
    urgence: 'MOYENNE',
    dateDisponibilite: '',
    dateLimiteCollecte: '',
    adresseCollecte: '',
    latitude: 36.8065,
    longitude: 10.1815
  };

  protected readonly rechercheInventaire = signal('');
  protected readonly filtreDonationCategorie = signal('TOUS');
  protected readonly triDonation = signal<'DATE' | 'URGENCE' | 'POIDS' | 'EXPIRATION'>('DATE');
  protected readonly donationSelectionnee = signal<Donation | null>(null);
  protected readonly suggestionCategorieDon = signal<{ typeProduit: string; categorie: Categorie | null } | null>(null);
  protected readonly urgenceAutoCalculee = signal(false);

  protected readonly formulaireCategorieOuvert = signal(false);
  protected readonly categorieEnEdition = signal<Categorie | null>(null);
  protected readonly categorieForm = {
    nom: '',
    description: '',
    typeProduit: 'FRUITS_LEGUMES',
    prioriteRedistribution: 'MOYENNE',
    dureeConservationEstimee: 7
  };

  protected readonly dashboardAdmin = signal<DashboardAdmin | null>(null);
  protected readonly utilisateurs = signal<Utilisateur[]>([]);
  protected readonly editionUtilisateur = signal<Utilisateur | null>(null);
  protected readonly roleUtilisateur = signal('');
  protected readonly statutUtilisateur = signal('');

  protected readonly profilTelephone = signal('');
  protected readonly profilAdresse = signal('');

  protected readonly dateDuJour = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date());

  protected readonly navigation = computed(() => {
    const role = this.utilisateur()?.role;
    const items: Array<{ id: Section; label: string; icon: string }> = [
      { id: 'overview', label: 'Vue générale', icon: '⌂' },
      { id: 'annonces', label: 'Annonces', icon: '▤' }
    ];

    if (role === 'FOURNISSEUR' || role === 'ONG') {
      items.push({ id: 'matching', label: 'Matching', icon: '◇' });
    }
    if (role !== 'CITOYEN') {
      items.push({ id: 'messages', label: 'Messages', icon: '◫' });
    }
    if (['ADMIN', 'TRANSPORTEUR', 'FOURNISSEUR', 'ONG'].includes(role || '')) {
      items.push({ id: 'logistique', label: 'Logistique', icon: '↗' });
    }
    if (['ADMIN', 'FOURNISSEUR', 'ONG', 'TRANSPORTEUR'].includes(role || '')) {
      items.push({ id: 'inventaire', label: 'Inventaire', icon: '▦' });
    }
    if (role === 'ADMIN') {
      items.push({ id: 'admin', label: 'Administration', icon: '⚙' });
    }
    items.push({ id: 'profile', label: 'Mon profil', icon: '○' });
    items.push({ id: 'diagnostic', label: 'Diagnostic', icon: '✓' });
    return items;
  });

  protected readonly annoncesFiltrees = computed(() => {
    const filtre = this.filtreAnnonce();
    const categorie = this.filtreCategorie();
    const recherche = this.rechercheAnnonce().trim().toLowerCase();
    const tri = this.triAnnonce();

    let resultat = this.annonces().filter((annonce) => {
      const typeOk = filtre === 'TOUS' || annonce.type === filtre;
      const categorieOk =
        categorie === 'TOUS' || annonce.categorieDonation?._id === categorie;
      const texte =
        `${annonce.titre} ${annonce.description} ${annonce.auteur?.nom} ${annonce.categorieDonation?.nom}`.toLowerCase();
      return typeOk && categorieOk && (!recherche || texte.includes(recherche));
    });

    const niveaux: Record<string, number> = { ELEVEE: 3, MOYENNE: 2, FAIBLE: 1 };

    if (tri === 'URGENCE') {
      resultat = [...resultat].sort(
        (a, b) => (niveaux[b.urgence] || 0) - (niveaux[a.urgence] || 0)
      );
    } else if (tri === 'EXPIRATION') {
      resultat = [...resultat].sort(
        (a, b) =>
          new Date(a.dateExpiration).getTime() -
          new Date(b.dateExpiration).getTime()
      );
    } else {
      resultat = [...resultat].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    return resultat;
  });
  protected readonly filtreCategorie = signal('TOUS');
  protected readonly triAnnonce = signal<'RECENT' | 'URGENCE' | 'EXPIRATION'>('RECENT');
  protected readonly suggestionCategorieIA = signal<{
  typeProduit: string;
  categorie: Categorie | null;
} | null>(null);

  protected readonly donationsFiltrees = computed(() => {
    const statut = this.filtreDonationStatut();
    const urgence = this.filtreDonationUrgence();
    const categorie = this.filtreDonationCategorie();
    const recherche = this.rechercheInventaire().trim().toLowerCase();
    const tri = this.triDonation();
    const niveaux: Record<string, number> = { ELEVEE: 3, MOYENNE: 2, FAIBLE: 1 };

    let result = this.donations().filter((d) => {
      const statutOk = statut === 'TOUS' || d.statut === statut;
      const urgenceOk = urgence === 'TOUS' || d.urgence === urgence;
      const categorieOk = categorie === 'TOUS' || d.categorieDonation?._id === categorie;
      const texte = `${d.titre} ${d.description || ''} ${d.adresseCollecte || ''} ${d.categorieDonation?.nom || ''}`.toLowerCase();
      const rechercheOk = !recherche || texte.includes(recherche);
      return statutOk && urgenceOk && categorieOk && rechercheOk;
    });

    if (tri === 'URGENCE') {
      result = [...result].sort((a, b) => (niveaux[b.urgence] || 0) - (niveaux[a.urgence] || 0));
    } else if (tri === 'POIDS') {
      result = [...result].sort((a, b) => b.poidsTotalKg - a.poidsTotalKg);
    } else if (tri === 'EXPIRATION') {
      result = [...result].sort((a, b) =>
        new Date(a.dateLimiteCollecte || 0).getTime() - new Date(b.dateLimiteCollecte || 0).getTime()
      );
    } else {
      result = [...result].sort((a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
    }
    return result;
  });

  protected readonly statsInventaire = computed(() => {
    const dons = this.donations();
    const parStatut: Record<string, number> = {};
    let poidsTotal = 0;
    let urgencesElevees = 0;

    for (const d of dons) {
      const s = d.statut || 'CREE';
      parStatut[s] = (parStatut[s] || 0) + 1;
      poidsTotal += d.poidsTotalKg || 0;
      if (d.urgence === 'ELEVEE') urgencesElevees++;
    }
    const maxStatut = Math.max(1, ...Object.values(parStatut));
    return {
      total: dons.length,
      parStatut,
      poidsTotal: Math.round(poidsTotal * 10) / 10,
      urgencesElevees,
      maxStatut,
      livres: parStatut['LIVRE'] || 0
    };
  });

  protected readonly collectesFiltrees = computed(() => {
    const statut = this.filtreStatut();
    const texte = this.rechercheCollecte().trim().toLowerCase();
    return this.collectes().filter((collecte) => {
      const statutOk = statut === 'TOUS' || collecte.statut === statut;
      const contenu =
        `${collecte.reference} ${collecte.donation?.titre} ${collecte.adresseDepart} ${collecte.adresseArrivee}`.toLowerCase();
      return statutOk && (!texte || contenu.includes(texte));
    });
  });

  protected readonly maximumActivite = computed(() =>
    Math.max(
      1,
      ...this.dashboardLogistique().activite.map(({ livraisons }) => livraisons)
    )
  );

  protected readonly risquesCritiques = computed(
    () =>
      Object.values(this.risquesRetard()).filter(
        ({ analyse }) => analyse.niveau === 'CRITIQUE'
      ).length
  );

  protected readonly risquesAttention = computed(
    () =>
      Object.values(this.risquesRetard()).filter(
        ({ analyse }) => analyse.niveau === 'ATTENTION'
      ).length
  );

  protected readonly couverture = computed(() => {
    const role = this.utilisateur()?.role;
    return [
      {
        nom: 'Authentification',
        disponible: true,
        detail: `Session ${role || 'inconnue'} active`
      },
      {
        nom: 'Annonces',
        disponible: true,
        detail: `${this.annonces().length} annonce(s) chargée(s)`
      },
      {
        nom: 'Matching',
        disponible: role === 'FOURNISSEUR' || role === 'ONG',
        detail: `${this.matchings().length} matching(s)`
      },
      {
        nom: 'Messagerie',
        disponible: role !== 'CITOYEN',
        detail: `${this.conversations().length} conversation(s)`
      },
      {
        nom: 'Logistique',
        disponible: ['ADMIN', 'TRANSPORTEUR', 'FOURNISSEUR', 'ONG'].includes(
          role || ''
        ),
        detail: `${this.collectes().length} collecte(s)`
      },
      {
        nom: 'Administration',
        disponible: role === 'ADMIN',
        detail: `${this.utilisateurs().length} utilisateur(s)`
      },
      {
        nom: 'Inventaire / donations',
        disponible: true,
        detail: `${this.donations().length} don(s) chargé(s), CRUD complet`
      }
    ];
  });

  @ViewChild('mapContainer')
  set mapContainer(element: ElementRef<HTMLDivElement> | undefined) {
    this.mapElement = element?.nativeElement;
    if (this.mapElement && this.section() === 'logistique') {
      window.setTimeout(() => this.initialiserCarte());
    }
  }

  ngOnInit(): void {
    const token = localStorage.getItem('rescuefood_token');
    this.chargerDonneesPubliques();
    if (!token) return;

    this.http
      .get<{ user: Utilisateur }>('/api/auth/me', {
        headers: this.entetes(token)
      })
      .subscribe({
        next: ({ user }) => {
          this.initialiserUtilisateur(user);
          this.chargerTout();
        },
        error: () => this.deconnexion(false)
      });
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  protected choisirCompte(compte: CompteDemo): void {
    this.email.set(compte.email);
    this.motDePasse.set('Demo1234!');
  }

  protected connexion(): void {
    this.chargementConnexion.set(true);
    this.effacerMessages();
    this.http
      .post<{ accessToken: string; user: Utilisateur }>('/api/auth/login', {
        email: this.email(),
        motDePasse: this.motDePasse()
      })
      .subscribe({
        next: ({ accessToken, user }) => {
          localStorage.setItem('rescuefood_token', accessToken);
          this.initialiserUtilisateur(user);
          this.chargementConnexion.set(false);
          this.section.set('overview');
          this.chargerTout();
        },
        error: (error) => {
          this.chargementConnexion.set(false);
          this.erreur.set(
            error.error?.message ||
              'Connexion impossible. Vérifiez que l’API et MongoDB sont lancés.'
          );
        }
      });
  }

  protected basculerVersInscription(): void {
    this.effacerMessages();
    this.inscriptionSucces.set('');
    this.vueAuth.set('inscription');
  }

  protected basculerVersConnexion(): void {
    this.effacerMessages();
    this.inscriptionSucces.set('');
    this.vueAuth.set('connexion');
  }

  protected basculerVersConnexionOng(): void {
    this.effacerMessages();
    this.inscriptionSucces.set('');
    this.vueAuth.set('connexion-ong');
  }

  protected libelleCategorieAssociation(valeur: string | null | undefined): string {
    return this.categoriesAssociation.find(c => c.value === valeur)?.label ?? 'Association';
  }

  protected emojiCategorieAssociation(valeur: string | null | undefined): string {
    return this.categoriesAssociation.find(c => c.value === valeur)?.emoji ?? '🌍';
  }

  protected inscrire(): void {
    this.chargementInscription.set(true);
    this.effacerMessages();
    this.http
      .post<{ message: string }>('/api/auth/register', {
        nom: this.registerForm.nom,
        prenom: this.registerForm.prenom,
        email: this.registerForm.email,
        motDePasse: this.registerForm.motDePasse,
        telephone: this.registerForm.telephone,
        role: this.registerForm.role,
        adresse: this.registerForm.adresse,
        ...(this.registerForm.role === 'ONG' && { categorieAssociation: this.registerForm.categorieAssociation })
      })
      .subscribe({
        next: ({ message }) => {
          this.chargementInscription.set(false);
          this.inscriptionSucces.set(message);
        },
        error: (error) => {
          this.chargementInscription.set(false);
          this.erreur.set(error.error?.message || 'Inscription impossible.');
        }
      });
  }

  protected deconnexion(appelerApi = true): void {
    if (appelerApi && this.utilisateur()) {
      this.http
        .post('/api/auth/logout', {}, { headers: this.entetes() })
        .subscribe({ error: () => undefined });
    }
    localStorage.removeItem('rescuefood_token');
    this.utilisateur.set(null);
    this.section.set('overview');
    this.collectes.set([]);
    this.conversations.set([]);
    this.matchings.set([]);
    this.suggestions.set([]);
    this.utilisateurs.set([]);
    this.map?.remove();
    this.map = undefined;
  }

  protected naviguer(section: Section): void {
    this.section.set(section);
    this.effacerMessages();
    if (section === 'logistique') {
      window.setTimeout(() => this.initialiserCarte());
    }
  }

  protected chargerTout(): void {
    this.chargement.set(true);
    this.chargerDonneesPubliques();
    this.chargerConversations();
    this.chargerInventaire();
    const role = this.utilisateur()?.role;

    if (role === 'FOURNISSEUR' || role === 'ONG') {
      this.chargerMesAnnonces();
      this.chargerMatching();
    }
    if (['ADMIN', 'TRANSPORTEUR', 'FOURNISSEUR', 'ONG'].includes(role || '')) {
      this.chargerLogistique();
    }
    if (role === 'ADMIN') {
      this.chargerAdministration();
    }
    window.setTimeout(() => this.chargement.set(false), 350);
  }

  protected peutPublier(): boolean {
    return ['FOURNISSEUR', 'ONG'].includes(this.utilisateur()?.role || '');
  }

  protected ouvrirFormulaireAnnonce(): void {
    const utilisateur = this.utilisateur();
    this.annonceForm.titre = '';
    this.annonceForm.description = '';
    this.annonceForm.categorieDonation = this.categories()[0]?._id || '';
    this.annonceForm.quantiteEstimee = 10;
    this.annonceForm.unite = 'KG';
    this.annonceForm.urgence = 'MOYENNE';
    this.annonceForm.adresse = utilisateur?.adresse || '';
    this.annonceForm.latitude = utilisateur?.localisation?.latitude || 36.8065;
    this.annonceForm.longitude = utilisateur?.localisation?.longitude || 10.1815;
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + 2);
    this.annonceForm.dateExpiration = expiration.toISOString().slice(0, 16);
    this.annonceEnEdition.set(null);
    this.suggestionCategorieIA.set(null);
    this.formulaireAnnonceOuvert.set(true);
  }

  protected creerAnnonce(): void {
    const role = this.utilisateur()?.role;
    const type = role === 'FOURNISSEUR' ? 'OFFRE' : 'DEMANDE';
    this.http
      .post(
        '/api/annonces',
        {
          type,
          titre: this.annonceForm.titre,
          description: this.annonceForm.description,
          categorieDonation: this.annonceForm.categorieDonation,
          quantiteEstimee: Number(this.annonceForm.quantiteEstimee),
          unite: this.annonceForm.unite,
          urgence: this.annonceForm.urgence,
          adresse: this.annonceForm.adresse,
          localisation: {
            latitude: Number(this.annonceForm.latitude),
            longitude: Number(this.annonceForm.longitude)
          },
          dateExpiration: new Date(
            this.annonceForm.dateExpiration
          ).toISOString()
        },
        { headers: this.entetes() }
      )
      .subscribe({
        next: () => {
          this.formulaireAnnonceOuvert.set(false);
          this.notifier('Annonce publiée avec succès.');
          this.chargerDonneesPubliques();
          this.chargerMesAnnonces();
          this.chargerMatching();
        },
        error: (error) => this.signaler(error, 'Publication impossible.')
      });
  }

  protected annulerAnnonce(annonce: Annonce): void {
    this.http
      .delete(`/api/annonces/${annonce._id}`, { headers: this.entetes() })
      .subscribe({
        next: () => {
          this.notifier('Annonce annulée.');
          this.chargerDonneesPubliques();
          this.chargerMesAnnonces();
        },
        error: (error) => this.signaler(error, 'Annulation impossible.')
      });
  }

  protected estAuteur(annonce: Annonce): boolean {
    const userId = this.utilisateur()?.id || this.utilisateur()?._id;
    const auteurId = annonce.auteur?.id || annonce.auteur?._id;
    return !!(userId && auteurId && userId === auteurId);
  }

  protected ouvrirEditionAnnonce(annonce: Annonce): void {
    this.annonceEnEdition.set(annonce);
    this.annonceForm.titre = annonce.titre;
    this.annonceForm.description = annonce.description;
    this.annonceForm.categorieDonation = annonce.categorieDonation._id;
    this.annonceForm.quantiteEstimee = annonce.quantiteEstimee;
    this.annonceForm.unite = annonce.unite;
    this.annonceForm.urgence = annonce.urgence;
    this.annonceForm.adresse = annonce.adresse;
    this.annonceForm.latitude = annonce.localisation?.latitude ?? 36.8065;
    this.annonceForm.longitude = annonce.localisation?.longitude ?? 10.1815;
    this.annonceForm.dateExpiration = new Date(annonce.dateExpiration)
      .toISOString()
      .slice(0, 16);
    this.suggestionCategorieIA.set(null);
    this.formulaireAnnonceOuvert.set(true);
  }

  protected modifierAnnonce(): void {
    const annonce = this.annonceEnEdition();
    if (!annonce) return;
    this.http
      .patch(
        `/api/annonces/${annonce._id}`,
        {
          titre: this.annonceForm.titre,
          description: this.annonceForm.description,
          quantiteEstimee: Number(this.annonceForm.quantiteEstimee),
          unite: this.annonceForm.unite,
          urgence: this.annonceForm.urgence,
          adresse: this.annonceForm.adresse,
          localisation: {
            latitude: Number(this.annonceForm.latitude),
            longitude: Number(this.annonceForm.longitude)
          },
          dateExpiration: new Date(this.annonceForm.dateExpiration).toISOString()
        },
        { headers: this.entetes() }
      )
      .subscribe({
        next: () => {
          this.fermerFormulaireAnnonce();
          this.notifier('Annonce modifiée avec succès.');
          this.chargerDonneesPubliques();
          this.chargerMesAnnonces();
          this.chargerMatching();
        },
        error: (error) => this.signaler(error, 'Modification impossible.')
      });
  }

  protected fermerFormulaireAnnonce(): void {
    this.annonceEnEdition.set(null);
    this.suggestionCategorieIA.set(null);
    this.formulaireAnnonceOuvert.set(false);
  }

  protected accepterSuggestion(suggestion: Suggestion): void {
    const offreId =
      suggestion.monAnnonce.type === 'OFFRE'
        ? suggestion.monAnnonce.id
        : suggestion.annonceCompatible.id;
    const demandeId =
      suggestion.monAnnonce.type === 'DEMANDE'
        ? suggestion.monAnnonce.id
        : suggestion.annonceCompatible.id;

    this.http
      .post(
        '/api/matchings',
        { offreId, demandeId },
        { headers: this.entetes() }
      )
      .subscribe({
        next: () => {
          this.notifier('Matching accepté et conversation créée.');
          this.chargerMatching();
          this.chargerConversations();
          this.chargerDonneesPubliques();
        },
        error: (error) => this.signaler(error, 'Matching impossible.')
      });
  }

  protected refuserMatching(matching: Matching): void {
    this.http
      .patch(
        `/api/matchings/${matching._id}/refuser`,
        {},
        { headers: this.entetes() }
      )
      .subscribe({
        next: () => {
          this.notifier('Matching refusé.');
          this.chargerMatching();
          this.chargerDonneesPubliques();
        },
        error: (error) => this.signaler(error, 'Refus impossible.')
      });
  }

  protected ouvrirConversation(conversation: Conversation): void {
    this.conversationSelectionnee.set(conversation);
    this.messages.set([]);
    this.http
      .get<{ messages: Message[] }>(
        `/api/conversations/${conversation._id}/messages`,
        { headers: this.entetes() }
      )
      .subscribe({
        next: ({ messages }) => this.messages.set(messages),
        error: (error) => this.signaler(error, 'Messages indisponibles.')
      });
  }

  protected envoyerMessage(): void {
    const conversation = this.conversationSelectionnee();
    const contenu = this.nouveauMessage().trim();
    if (!conversation || !contenu) return;

    this.http
      .post(
        `/api/conversations/${conversation._id}/messages`,
        { contenu },
        { headers: this.entetes() }
      )
      .subscribe({
        next: () => {
          this.nouveauMessage.set('');
          this.ouvrirConversation(conversation);
          this.chargerConversations();
        },
        error: (error) => this.signaler(error, 'Envoi impossible.')
      });
  }

  protected autreParticipant(conversation: Conversation): Utilisateur | undefined {
    const id = this.utilisateur()?.id || this.utilisateur()?._id;
    return conversation.participants.find(
      (participant) => (participant.id || participant._id) !== id
    );
  }

  protected ouvrirCollecte(collecte: Collecte): void {
    this.collecteSelectionnee.set(collecte);
    this.transporteurSelectionne.set(collecte.transporteur?._id || '');
    this.vehicule.set(collecte.vehicule || '');
    this.recommandationsTransporteurs.set([]);
    if (
      this.utilisateur()?.role === 'ADMIN' &&
      ['A_ASSIGNER', 'PLANIFIEE'].includes(collecte.statut)
    ) {
      this.chargerRecommandations(collecte);
    }
  }

  protected fermerCollecte(): void {
    this.collecteSelectionnee.set(null);
    this.recommandationsTransporteurs.set([]);
  }

  protected choisirTransporteurRecommande(
    recommandation: RecommandationTransporteur
  ): void {
    this.transporteurSelectionne.set(recommandation.transporteur.id);
  }

  protected optimiserTournee(): void {
    const role = this.utilisateur()?.role;
    const transporteurId =
      role === 'ADMIN' ? this.transporteurIASelectionne() : undefined;
    if (role === 'ADMIN' && !transporteurId) return;

    this.optimisationEnCours.set(true);
    this.http
      .post<ItineraireIA>(
        '/api/logistique/ia/itineraire/optimiser',
        transporteurId ? { transporteurId } : {},
        { headers: this.entetes() }
      )
      .subscribe({
        next: (resultat) => {
          this.itineraireIA.set(resultat);
          this.optimisationEnCours.set(false);
        },
        error: (error) => {
          this.optimisationEnCours.set(false);
          this.signaler(error, 'Optimisation indisponible.')
        }
      });
  }

  protected assigner(): void {
    const collecte = this.collecteSelectionnee();
    if (!collecte || !this.transporteurSelectionne()) return;
    this.http
      .patch(
        `/api/logistique/collectes/${collecte._id}/assignation`,
        {
          transporteurId: this.transporteurSelectionne(),
          vehicule: this.vehicule()
        },
        { headers: this.entetes() }
      )
      .subscribe({
        next: () => {
          this.collecteSelectionnee.set(null);
          this.notifier('Transporteur assigné.');
          this.chargerLogistique();
        },
        error: (error) => this.signaler(error, 'Assignation impossible.')
      });
  }

  protected avancerStatut(collecte: Collecte, statut: string): void {
    this.http
      .patch(
        `/api/logistique/collectes/${collecte._id}/statut`,
        { statut },
        { headers: this.entetes() }
      )
      .subscribe({
        next: () => {
          this.collecteSelectionnee.set(null);
          this.notifier(`Collecte passée au statut ${this.libelleStatut(statut)}.`);
          this.chargerLogistique();
        },
        error: (error) => this.signaler(error, 'Mise à jour impossible.')
      });
  }

  protected envoyerPosition(collecte: Collecte): void {
    const position = collecte.transporteur
      ? { latitude: 36.81, longitude: 10.18 }
      : undefined;
    if (!position) return;

    this.http
      .patch(
        `/api/logistique/collectes/${collecte._id}/position`,
        position,
        { headers: this.entetes() }
      )
      .subscribe({
        next: () => {
          this.notifier('Position GPS de test envoyée.');
          this.chargerLogistique();
        },
        error: (error) => this.signaler(error, 'Position refusée.')
      });
  }

  protected telechargerRapport(): void {
    this.http
      .get('/api/logistique/rapport.pdf', {
        headers: this.entetes(),
        responseType: 'blob'
      })
      .subscribe({
        next: (fichier) => {
          const url = URL.createObjectURL(fichier);
          const lien = document.createElement('a');
          lien.href = url;
          lien.download = `rapport-logistique-${new Date()
            .toISOString()
            .slice(0, 10)}.pdf`;
          lien.click();
          URL.revokeObjectURL(url);
          this.notifier('Rapport PDF généré.');
        },
        error: (error) => this.signaler(error, 'Rapport indisponible.')
      });
  }

  protected editerAcces(utilisateur: Utilisateur): void {
    this.editionUtilisateur.set(utilisateur);
    this.roleUtilisateur.set(utilisateur.role);
    this.statutUtilisateur.set(utilisateur.statutCompte || 'EN_ATTENTE');
  }

  protected enregistrerAcces(): void {
    const utilisateur = this.editionUtilisateur();
    if (!utilisateur?._id) return;
    this.http
      .patch(
        `/api/admin/users/${utilisateur._id}/access`,
        {
          role: this.roleUtilisateur(),
          statutCompte: this.statutUtilisateur()
        },
        { headers: this.entetes() }
      )
      .subscribe({
        next: () => {
          this.editionUtilisateur.set(null);
          this.notifier('Accès utilisateur mis à jour.');
          this.chargerAdministration();
        },
        error: (error) => this.signaler(error, 'Modification impossible.')
      });
  }

  protected enregistrerProfil(): void {
    this.http
      .patch(
        '/api/auth/me',
        {
          telephone: this.profilTelephone(),
          adresse: this.profilAdresse()
        },
        { headers: this.entetes() }
      )
      .subscribe({
        next: (resultat: any) => {
          this.initialiserUtilisateur(resultat.user);
          this.notifier('Profil mis à jour.');
        },
        error: (error) => this.signaler(error, 'Profil non modifié.')
      });
  }

  protected libelleStatut(statut: string): string {
    const libelles: Record<string, string> = {
      TOUS: 'Tous',
      A_ASSIGNER: 'À assigner',
      PLANIFIEE: 'Planifiée',
      EN_ROUTE: 'En route',
      COLLECTEE: 'Collectée',
      LIVREE: 'Livrée',
      ANNULEE: 'Annulée',
      ACTIVE: 'Active',
      MATCHEE: 'Matchée',
      CLOTUREE: 'Clôturée',
      EXPIREE: 'Expirée',
      ACCEPTE: 'Accepté',
      REFUSE: 'Refusé',
      CONVERTI_EN_DON: 'Converti en don'
    };
    return libelles[statut] || statut;
  }

  protected dateCourte(date?: string): string {
    if (!date) return 'Non renseignée';
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  }

  protected jourCourt(date: string): string {
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(
      new Date(date)
    );
  }

  protected pourcentage(score: number): string {
    return `${Math.round(score * 100)}%`;
  }

  protected tempsRestant(dateExpiration: string): string {
    const diffMs = new Date(dateExpiration).getTime() - Date.now();
    if (diffMs <= 0) return 'Expirée';
    const heures = Math.floor(diffMs / (1000 * 60 * 60));
    if (heures < 1) {
      const minutes = Math.floor(diffMs / (1000 * 60));
      return `${minutes} min`;
    }
    if (heures < 24) return `${heures} h`;
    return `${Math.floor(heures / 24)} j`;
  }

  protected niveauUrgenceTemps(dateExpiration: string): 'FAIBLE' | 'ATTENTION' | 'CRITIQUE' {
    const heures = (new Date(dateExpiration).getTime() - Date.now()) / (1000 * 60 * 60);
    if (heures <= 6) return 'CRITIQUE';
    if (heures <= 24) return 'ATTENTION';
    return 'FAIBLE';
  }

  protected explicationMatching(suggestion: Suggestion): {
    categorie: string;
    distance: string;
    quantite: string;
    recommandation: string;
    niveau: 'FAIBLE' | 'ATTENTION' | 'CRITIQUE';
  } {
    const { criteres, distanceKm, score } = suggestion;

    const categorie =
      criteres['categorie'] === 1
        ? 'Même catégorie alimentaire'
        : 'Catégories différentes';

    const distance =
      distanceKm < 5
        ? 'Très proche — collecte facile'
        : distanceKm < 20
        ? 'Distance raisonnable'
        : 'Distance importante';

    const quantite =
      criteres['quantite'] >= 0.8
        ? 'Quantités très proches'
        : criteres['quantite'] >= 0.5
        ? 'Quantités compatibles'
        : 'Écart de quantité important';

    let recommandation: string;
    let niveau: 'FAIBLE' | 'ATTENTION' | 'CRITIQUE';

    if (score > 0.7) {
      recommandation = 'Excellent matching — fortement recommandé';
      niveau = 'FAIBLE';
    } else if (score > 0.5) {
      recommandation = 'Bon matching — recommandé';
      niveau = 'ATTENTION';
    } else {
      recommandation = 'Matching possible — à évaluer';
      niveau = 'CRITIQUE';
    }

    return { categorie, distance, quantite, recommandation, niveau };
  }

  protected onAnnonceTexteChange(): void {
    this.suggestionCategorieIA.set(null);
    clearTimeout(this.suggestionTimeout);
    this.suggestionTimeout = setTimeout(() => this.suggererCategorieIA(), 600);
  }

  private suggererCategorieIA(): void {
    const titre = this.annonceForm.titre.trim();
    if (titre.length < 3) return;

    this.http
      .get<{ suggestion: { typeProduit: string; categorie: Categorie | null } }>(
        '/api/annonces/suggestion-categorie',
        {
          headers: this.entetes(),
          params: { titre, description: this.annonceForm.description || '' }
        }
      )
      .subscribe({
        next: ({ suggestion }) => this.suggestionCategorieIA.set(suggestion),
        error: () => this.suggestionCategorieIA.set(null)
      });
  }

  protected appliquerSuggestionCategorie(): void {
    const suggestion = this.suggestionCategorieIA();
    if (suggestion?.categorie?._id) {
      this.annonceForm.categorieDonation = suggestion.categorie._id;
      this.suggestionCategorieIA.set(null);
    }
  }

  protected statutsActionnables(collecte: Collecte): string[] {
    if (collecte.statut === 'A_ASSIGNER' && !collecte.transporteur) {
      return collecte.prochainsStatuts.filter((statut) => statut === 'ANNULEE');
    }
    return collecte.prochainsStatuts;
  }

  protected initiales(utilisateur = this.utilisateur()): string {
    return utilisateur
      ? `${utilisateur.prenom?.[0] || ''}${utilisateur.nom?.[0] || ''}`
      : 'RF';
  }

  protected totalParRole(role: string): number {
    return (
      this.dashboardAdmin()?.utilisateurs.parRole.find(
        (item) => item._id === role
      )?.total || 0
    );
  }

  protected onTitreDonChange(): void {
    this.suggestionCategorieDon.set(null);
    clearTimeout(this.suggestionTimeout);
    this.suggestionTimeout = setTimeout(() => {
      const titre = this.donationForm.titre.trim();
      if (titre.length < 3) return;
      this.http
        .get<{ suggestion: { typeProduit: string; categorie: Categorie | null } }>(
          '/api/annonces/suggestion-categorie',
          { params: { titre, description: this.donationForm.description || '' } }
        )
        .subscribe({
          next: ({ suggestion }) => this.suggestionCategorieDon.set(suggestion),
          error: () => this.suggestionCategorieDon.set(null)
        });
    }, 600);
  }

  protected appliquerSuggestionCategorieDon(): void {
    const s = this.suggestionCategorieDon();
    if (s?.categorie?._id) {
      this.donationForm.categorieDonation = s.categorie._id;
      this.suggestionCategorieDon.set(null);
    }
  }

  protected onDateLimiteChange(): void {
    const valeur = this.donationForm.dateLimiteCollecte;
    if (!valeur) return;
    const heures = (new Date(valeur).getTime() - Date.now()) / 3600000;
    if (heures <= 24) {
      this.donationForm.urgence = 'ELEVEE';
    } else if (heures <= 72) {
      this.donationForm.urgence = 'MOYENNE';
    } else {
      this.donationForm.urgence = 'FAIBLE';
    }
    this.urgenceAutoCalculee.set(true);
  }

  protected ouvrirDetailDonation(donation: Donation): void {
    this.donationSelectionnee.set(donation);
  }

  protected fermerDetailDonation(): void {
    this.donationSelectionnee.set(null);
  }

  protected niveauExpiration(don: Donation): 'CRITIQUE' | 'ATTENTION' | null {
    if (!don.dateLimiteCollecte) return null;
    if (['LIVRE', 'ANNULE'].includes(don.statut || '')) return null;
    const heures = (new Date(don.dateLimiteCollecte).getTime() - Date.now()) / (1000 * 60 * 60);
    if (heures <= 0) return 'CRITIQUE';
    if (heures <= 24) return 'CRITIQUE';
    if (heures <= 48) return 'ATTENTION';
    return null;
  }

  protected readonly insightsIA = computed(() => {
    const dons = this.donations();
    if (!dons.length) return [];
    const insights: Array<{ niveau: 'urgent' | 'warning' | 'info'; message: string }> = [];

    const expirantBientot = dons.filter((d) => {
      if (!d.dateLimiteCollecte || ['LIVRE', 'ANNULE'].includes(d.statut || '')) return false;
      const h = (new Date(d.dateLimiteCollecte).getTime() - Date.now()) / 3600000;
      return h > 0 && h <= 24;
    });
    if (expirantBientot.length)
      insights.push({ niveau: 'urgent', message: `${expirantBientot.length} don(s) expirent dans moins de 24h — action urgente requise` });

    const parCat: Record<string, { nom: string; count: number }> = {};
    for (const d of dons) {
      if (d.categorieDonation) {
        const id = d.categorieDonation._id;
        if (!parCat[id]) parCat[id] = { nom: d.categorieDonation.nom, count: 0 };
        parCat[id].count++;
      }
    }
    const topCat = Object.values(parCat).sort((a, b) => b.count - a.count)[0];
    if (topCat) {
      const pct = Math.round((topCat.count / dons.length) * 100);
      insights.push({ niveau: 'info', message: `"${topCat.nom}" représente ${pct}% de l'inventaire — prioriser la redistribution` });
    }

    const livres = dons.filter((d) => d.statut === 'LIVRE').length;
    const taux = Math.round((livres / dons.length) * 100);
    insights.push({ niveau: taux >= 50 ? 'info' : 'warning', message: `Taux de livraison : ${taux}% (${livres}/${dons.length} dons livrés)` });

    const enAttente = dons.filter((d) => d.statut === 'EN_ATTENTE_VALIDATION').length;
    if (enAttente)
      insights.push({ niveau: 'warning', message: `${enAttente} don(s) en attente de validation — intervention admin requise` });

    const urgentsNonTraites = dons.filter(
      (d) => d.urgence === 'ELEVEE' && !['LIVRE', 'ANNULE', 'EN_COLLECTE'].includes(d.statut || '')
    ).length;
    if (urgentsNonTraites)
      insights.push({ niveau: 'urgent', message: `${urgentsNonTraites} don(s) urgents non encore collectés` });

    return insights;
  });

  protected statsParStatutEntries(): Array<{ statut: string; count: number }> {
    const stats = this.statsInventaire();
    const ordre = ['CREE', 'EN_ATTENTE_VALIDATION', 'VALIDE', 'RESERVE', 'EN_COLLECTE', 'LIVRE', 'ANNULE'];
    return ordre
      .filter((s) => stats.parStatut[s])
      .map((s) => ({ statut: s, count: stats.parStatut[s] }));
  }

  protected ouvrirFormulaireDonation(donation?: Donation): void {
    if (donation) {
      this.donationEnEdition.set(donation);
      this.donationForm.titre = donation.titre;
      this.donationForm.description = donation.description || '';
      this.donationForm.categorieDonation = donation.categorieDonation?._id || '';
      this.donationForm.compositionLot = donation.compositionLot || '';
      this.donationForm.quantiteEstimee = donation.quantiteEstimee || 1;
      this.donationForm.unite = donation.unite || 'KG';
      this.donationForm.poidsTotalKg = donation.poidsTotalKg;
      this.donationForm.imageUrl = donation.images?.[0] || '';
      this.donationForm.temperatureStockage = donation.temperatureStockage?.toString() || '';
      this.donationForm.conditionsStockage = donation.conditionsStockage || '';
      this.donationForm.urgence = donation.urgence;
      this.donationForm.dateDisponibilite = donation.dateDisponibilite
        ? new Date(donation.dateDisponibilite).toISOString().slice(0, 16)
        : '';
      this.donationForm.dateLimiteCollecte = donation.dateLimiteCollecte
        ? new Date(donation.dateLimiteCollecte).toISOString().slice(0, 16)
        : '';
      this.donationForm.adresseCollecte = donation.adresseCollecte || '';
      this.donationForm.latitude = donation.localisationCollecte?.latitude ?? 36.8065;
      this.donationForm.longitude = donation.localisationCollecte?.longitude ?? 10.1815;
    } else {
      const u = this.utilisateur();
      this.donationEnEdition.set(null);
      this.donationForm.titre = '';
      this.donationForm.description = '';
      this.donationForm.categorieDonation = this.categories()[0]?._id || '';
      this.donationForm.compositionLot = '';
      this.donationForm.quantiteEstimee = 10;
      this.donationForm.unite = 'KG';
      this.donationForm.poidsTotalKg = 0;
      this.donationForm.imageUrl = '';
      this.donationForm.temperatureStockage = '';
      this.donationForm.conditionsStockage = '';
      this.donationForm.urgence = 'MOYENNE';
      const now = new Date();
      now.setHours(now.getHours() + 1);
      this.donationForm.dateDisponibilite = now.toISOString().slice(0, 16);
      const limite = new Date(now);
      limite.setDate(limite.getDate() + 2);
      this.donationForm.dateLimiteCollecte = limite.toISOString().slice(0, 16);
      this.donationForm.adresseCollecte = u?.adresse || '';
      this.donationForm.latitude = u?.localisation?.latitude ?? 36.8065;
      this.donationForm.longitude = u?.localisation?.longitude ?? 10.1815;
    }
    this.suggestionCategorieDon.set(null);
    this.urgenceAutoCalculee.set(false);
    this.formulaireDonationOuvert.set(true);
  }

  protected fermerFormulaireDonation(): void {
    this.donationEnEdition.set(null);
    this.suggestionCategorieDon.set(null);
    this.urgenceAutoCalculee.set(false);
    this.formulaireDonationOuvert.set(false);
  }

  protected enregistrerDonation(): void {
    const edition = this.donationEnEdition();
    const corps = {
      titre: this.donationForm.titre,
      description: this.donationForm.description,
      categorieDonation: this.donationForm.categorieDonation,
      compositionLot: this.donationForm.compositionLot,
      quantiteEstimee: Number(this.donationForm.quantiteEstimee),
      unite: this.donationForm.unite,
      poidsTotalKg: Number(this.donationForm.poidsTotalKg),
      images: [this.donationForm.imageUrl].filter(Boolean),
      temperatureStockage: this.donationForm.temperatureStockage
        ? Number(this.donationForm.temperatureStockage)
        : null,
      conditionsStockage: this.donationForm.conditionsStockage,
      urgence: this.donationForm.urgence,
      dateDisponibilite: new Date(this.donationForm.dateDisponibilite).toISOString(),
      dateLimiteCollecte: new Date(this.donationForm.dateLimiteCollecte).toISOString(),
      adresseCollecte: this.donationForm.adresseCollecte,
      localisationCollecte: {
        latitude: Number(this.donationForm.latitude),
        longitude: Number(this.donationForm.longitude)
      }
    };

    const requete = edition
      ? this.http.put(`/api/donations/${edition._id}`, corps, { headers: this.entetes() })
      : this.http.post('/api/donations', corps, { headers: this.entetes() });

    requete.subscribe({
      next: () => {
        this.fermerFormulaireDonation();
        this.notifier(edition ? 'Don modifié avec succès.' : 'Don créé avec succès.');
        this.chargerInventaire();
      },
      error: (error) => this.signaler(error, 'Enregistrement impossible.')
    });
  }

  protected supprimerDonation(donation: Donation): void {
    if (!confirm(`Supprimer le don "${donation.titre}" ?`)) return;
    this.http
      .delete(`/api/donations/${donation._id}`, { headers: this.entetes() })
      .subscribe({
        next: () => {
          this.notifier('Don supprimé.');
          this.chargerInventaire();
        },
        error: (error) => this.signaler(error, 'Suppression impossible.')
      });
  }

  protected changerStatutDonation(donation: Donation, statut: string): void {
    this.http
      .patch(
        `/api/donations/${donation._id}/statut`,
        { statut },
        { headers: this.entetes() }
      )
      .subscribe({
        next: () => {
          this.notifier(`Statut mis à jour : ${this.libelleStatutDon(statut)}.`);
          this.chargerInventaire();
        },
        error: (error) => this.signaler(error, 'Changement de statut impossible.')
      });
  }

  protected peutModifierDonation(donation: Donation): boolean {
    const role = this.utilisateur()?.role;
    if (role === 'ADMIN') return true;
    if (role === 'FOURNISSEUR') {
      const userId = this.utilisateur()?.id || this.utilisateur()?._id;
      const fId = donation.fournisseur?.id || donation.fournisseur?._id;
      return userId === fId;
    }
    return false;
  }

  protected peutSupprimerDonation(donation: Donation): boolean {
    if (['EN_COLLECTE', 'LIVRE'].includes(donation.statut || '')) return false;
    return this.peutModifierDonation(donation);
  }

  protected prochainStatutsDon(donation: Donation): string[] {
    const transitions: Record<string, string[]> = {
      CREE: ['EN_ATTENTE_VALIDATION', 'ANNULE'],
      EN_ATTENTE_VALIDATION: ['VALIDE', 'ANNULE'],
      VALIDE: ['RESERVE', 'ANNULE'],
      RESERVE: ['EN_COLLECTE', 'ANNULE'],
      EN_COLLECTE: ['LIVRE'],
      LIVRE: [],
      ANNULE: []
    };
    return transitions[donation.statut || 'CREE'] || [];
  }

  protected libelleStatutDon(statut: string): string {
    const libelles: Record<string, string> = {
      CREE: 'Créé',
      EN_ATTENTE_VALIDATION: 'En attente',
      VALIDE: 'Validé',
      RESERVE: 'Réservé',
      EN_COLLECTE: 'En collecte',
      LIVRE: 'Livré',
      ANNULE: 'Annulé'
    };
    return libelles[statut] || statut;
  }

  protected ouvrirFormulaireCategorie(categorie?: Categorie): void {
    if (categorie) {
      this.categorieEnEdition.set(categorie);
      this.categorieForm.nom = categorie.nom;
      this.categorieForm.description = categorie.description || '';
      this.categorieForm.typeProduit = categorie.typeProduit;
      this.categorieForm.prioriteRedistribution = categorie.prioriteRedistribution;
      this.categorieForm.dureeConservationEstimee = categorie.dureeConservationEstimee;
    } else {
      this.categorieEnEdition.set(null);
      this.categorieForm.nom = '';
      this.categorieForm.description = '';
      this.categorieForm.typeProduit = 'FRUITS_LEGUMES';
      this.categorieForm.prioriteRedistribution = 'MOYENNE';
      this.categorieForm.dureeConservationEstimee = 7;
    }
    this.formulaireCategorieOuvert.set(true);
  }

  protected fermerFormulaireCategorie(): void {
    this.categorieEnEdition.set(null);
    this.formulaireCategorieOuvert.set(false);
  }

  protected enregistrerCategorie(): void {
    const edition = this.categorieEnEdition();
    const corps = {
      nom: this.categorieForm.nom,
      description: this.categorieForm.description,
      typeProduit: this.categorieForm.typeProduit,
      prioriteRedistribution: this.categorieForm.prioriteRedistribution,
      dureeConservationEstimee: Number(this.categorieForm.dureeConservationEstimee)
    };

    const requete = edition
      ? this.http.put(`/api/categories/${edition._id}`, corps, { headers: this.entetes() })
      : this.http.post('/api/categories', corps, { headers: this.entetes() });

    requete.subscribe({
      next: () => {
        this.fermerFormulaireCategorie();
        this.notifier(edition ? 'Catégorie modifiée.' : 'Catégorie créée.');
        this.chargerDonneesPubliques();
      },
      error: (error) => this.signaler(error, 'Enregistrement impossible.')
    });
  }

  protected supprimerCategorie(categorie: Categorie): void {
    if (!confirm(`Supprimer la catégorie "${categorie.nom}" ?`)) return;
    this.http
      .delete(`/api/categories/${categorie._id}`, { headers: this.entetes() })
      .subscribe({
        next: () => {
          this.notifier('Catégorie supprimée.');
          this.chargerDonneesPubliques();
        },
        error: (error) => this.signaler(error, 'Suppression impossible.')
      });
  }

  private initialiserUtilisateur(user: Utilisateur): void {
    this.utilisateur.set(user);
    this.profilTelephone.set(user.telephone || '');
    this.profilAdresse.set(user.adresse || '');
  }

  private chargerInventaire(): void {
    this.http
      .get<{ donations: Donation[] }>('/api/donations?limit=100', {
        headers: this.entetes()
      })
      .subscribe({
        next: ({ donations }) => this.donations.set(donations),
        error: (error) => this.signaler(error, 'Inventaire indisponible.')
      });
  }

  private chargerDonneesPubliques(): void {
    this.http.get<{ categories: Categorie[] }>('/api/categories').subscribe({
      next: ({ categories }) => this.categories.set(categories),
      error: (error) => this.signaler(error, 'Catégories indisponibles.')
    });
    this.http.get<{ annonces: Annonce[] }>('/api/annonces').subscribe({
      next: ({ annonces }) => this.annonces.set(annonces),
      error: (error) => this.signaler(error, 'Annonces indisponibles.')
    });
    this.http.get<{ donations: Donation[] }>('/api/donations?limit=100', { headers: this.entetes() }).subscribe({
      next: ({ donations }) => this.donations.set(donations),
      error: () => {}
    });
  }

  private chargerMesAnnonces(): void {
    this.http
      .get<{ annonces: Annonce[] }>('/api/annonces/user/mes-annonces', {
        headers: this.entetes()
      })
      .subscribe({
        next: ({ annonces }) => this.mesAnnonces.set(annonces),
        error: (error) => this.signaler(error, 'Vos annonces sont indisponibles.')
      });
  }

  private chargerMatching(): void {
    this.http
      .get<{ suggestions: Suggestion[] }>('/api/matchings/suggestions', {
        headers: this.entetes()
      })
      .subscribe({
        next: ({ suggestions }) => this.suggestions.set(suggestions),
        error: (error) => this.signaler(error, 'Suggestions indisponibles.')
      });
    this.http
      .get<{ matchings: Matching[] }>('/api/matchings', {
        headers: this.entetes()
      })
      .subscribe({
        next: ({ matchings }) => this.matchings.set(matchings),
        error: (error) => this.signaler(error, 'Matchings indisponibles.')
      });
  }

  private chargerConversations(): void {
    if (!this.utilisateur() || this.utilisateur()?.role === 'CITOYEN') return;
    this.http
      .get<{ conversations: Conversation[] }>('/api/conversations', {
        headers: this.entetes()
      })
      .subscribe({
        next: ({ conversations }) => {
          this.conversations.set(conversations);
          const selection = this.conversationSelectionnee();
          if (selection) {
            const actualisee = conversations.find(
              (conversation) => conversation._id === selection._id
            );
            if (actualisee) this.conversationSelectionnee.set(actualisee);
          }
        },
        error: (error) => this.signaler(error, 'Conversations indisponibles.')
      });
  }

  private chargerLogistique(): void {
    const headers = this.entetes();
    this.http
      .get<DashboardLogistique>('/api/logistique/dashboard', { headers })
      .subscribe({
        next: (dashboard) => this.dashboardLogistique.set(dashboard),
        error: (error) => this.signaler(error, 'KPIs logistiques indisponibles.')
      });
    this.http
      .get<{ collectes: Collecte[] }>(
        '/api/logistique/collectes?limite=100',
        { headers }
      )
      .subscribe({
        next: ({ collectes }) => {
          this.collectes.set(collectes);
          this.chargerRisquesRetard(collectes);
        },
        error: (error) => this.signaler(error, 'Collectes indisponibles.')
      });
    this.http
      .get<{ points: PointCarte[] }>('/api/logistique/carte', { headers })
      .subscribe({
        next: ({ points }) => {
          this.pointsCarte.set(points);
          this.mettreAJourCarte();
        },
        error: (error) => this.signaler(error, 'Carte indisponible.')
      });
    if (this.utilisateur()?.role === 'ADMIN') {
      this.http
        .get<{ transporteurs: Transporteur[] }>(
          '/api/logistique/transporteurs',
          { headers }
        )
        .subscribe({
          next: ({ transporteurs }) => {
            this.transporteurs.set(transporteurs);
            if (!this.transporteurIASelectionne() && transporteurs.length) {
              this.transporteurIASelectionne.set(transporteurs[0]._id);
            }
          },
          error: (error) =>
            this.signaler(error, 'Transporteurs indisponibles.')
        });
    }
  }

  private chargerRisquesRetard(collectes: Collecte[]): void {
    this.risquesRetard.set({});
    for (const collecte of collectes.filter(
      ({ statut }) => !['LIVREE', 'ANNULEE'].includes(statut)
    )) {
      this.http
        .get<RisqueRetard>(
          `/api/logistique/ia/collectes/${collecte._id}/risque-retard`,
          { headers: this.entetes() }
        )
        .subscribe({
          next: (risque) =>
            this.risquesRetard.update((actuels) => ({
              ...actuels,
              [collecte._id]: risque
            }))
        });
    }
  }

  private chargerRecommandations(collecte: Collecte): void {
    this.http
      .get<{ recommandations: RecommandationTransporteur[] }>(
        `/api/logistique/ia/collectes/${collecte._id}/transporteurs-recommandes`,
        { headers: this.entetes() }
      )
      .subscribe({
        next: ({ recommandations }) =>
          this.recommandationsTransporteurs.set(recommandations),
        error: (error) =>
          this.signaler(error, 'Recommandations indisponibles.')
      });
  }

  private chargerAdministration(): void {
    const headers = this.entetes();
    this.http
      .get<DashboardAdmin>('/api/admin/dashboard', { headers })
      .subscribe({
        next: (dashboard) => this.dashboardAdmin.set(dashboard),
        error: (error) =>
          this.signaler(error, 'Statistiques administrateur indisponibles.')
      });
    this.http
      .get<{ users: Utilisateur[] }>('/api/admin/users', { headers })
      .subscribe({
        next: ({ users }) => this.utilisateurs.set(users),
        error: (error) => this.signaler(error, 'Utilisateurs indisponibles.')
      });
  }

  private entetes(token = localStorage.getItem('rescuefood_token') || '') {
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  private notifier(message: string): void {
    this.erreur.set('');
    this.succes.set(message);
    window.setTimeout(() => {
      if (this.succes() === message) this.succes.set('');
    }, 3500);
  }

  private signaler(error: any, message: string): void {
    if (error?.status === 401) {
      this.deconnexion(false);
      return;
    }
    this.succes.set('');
    this.erreur.set(error?.error?.message || message);
  }

  private effacerMessages(): void {
    this.erreur.set('');
    this.succes.set('');
  }

  private dashboardLogistiqueVide(): DashboardLogistique {
    return {
      kpis: {
        collectesTotal: 0,
        collectesActives: 0,
        livraisonsTerminees: 0,
        poidsLivreKg: 0,
        dureeMoyenneMinutes: 0,
        tauxPonctualite: 100
      },
      parStatut: {},
      activite: [],
      alertes: []
    };
  }

  private initialiserCarte(): void {
    if (!this.mapElement || this.map) {
      this.map?.invalidateSize();
      return;
    }
    this.map = L.map(this.mapElement, {
      zoomControl: false,
      attributionControl: true
    }).setView([36.8065, 10.1815], 12);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(this.map);
    this.markers = L.layerGroup().addTo(this.map);
    this.mettreAJourCarte();
  }

  private mettreAJourCarte(): void {
    if (!this.map || !this.markers) return;
    this.markers.clearLayers();
    const limites: L.LatLngExpression[] = [];

    for (const point of this.pointsCarte()) {
      const depart: L.LatLngExpression = [
        point.depart.latitude,
        point.depart.longitude
      ];
      const arrivee: L.LatLngExpression = [
        point.arrivee.latitude,
        point.arrivee.longitude
      ];
      limites.push(depart, arrivee);
      L.polyline([depart, arrivee], {
        color: point.statut === 'LIVREE' ? '#8da69a' : '#e27542',
        weight: 3,
        dashArray: point.statut === 'LIVREE' ? undefined : '7 8',
        opacity: 0.8
      }).addTo(this.markers);
      L.circleMarker(depart, {
        radius: 7,
        color: '#fff',
        weight: 3,
        fillColor: '#1f7a55',
        fillOpacity: 1
      })
        .bindPopup(`<strong>${point.reference}</strong><br>${point.depart.adresse}`)
        .addTo(this.markers);
      L.circleMarker(arrivee, {
        radius: 7,
        color: '#fff',
        weight: 3,
        fillColor: '#f3a45f',
        fillOpacity: 1
      })
        .bindPopup(`<strong>${point.titre}</strong><br>${point.arrivee.adresse}`)
        .addTo(this.markers);
      if (point.positionActuelle && point.statut === 'EN_ROUTE') {
        const position: L.LatLngExpression = [
          point.positionActuelle.latitude,
          point.positionActuelle.longitude
        ];
        limites.push(position);
        L.circleMarker(position, {
          radius: 10,
          color: '#fff',
          weight: 4,
          fillColor: '#172f27',
          fillOpacity: 1
        })
          .bindPopup(
            `<strong>Transport en cours</strong><br>${
              point.transporteur || 'Transporteur'
            }`
          )
          .addTo(this.markers);
      }
    }
    if (limites.length) {
      this.map.fitBounds(L.latLngBounds(limites), {
        padding: [35, 35],
        maxZoom: 13
      });
    }
    window.setTimeout(() => this.map?.invalidateSize(), 50);
  }
}
