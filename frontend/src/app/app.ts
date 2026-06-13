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
import { forkJoin, of } from 'rxjs';

interface Utilisateur {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: string;
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
  poidsTotalKg: number;
  urgence: string;
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

interface Coordonnees {
  latitude: number;
  longitude: number;
}

interface Kpis {
  collectesTotal: number;
  collectesActives: number;
  livraisonsTerminees: number;
  poidsLivreKg: number;
  dureeMoyenneMinutes: number;
  tauxPonctualite: number;
}

interface DashboardResponse {
  kpis: Kpis;
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

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private map?: L.Map;
  private markers?: L.LayerGroup;
  private mapElement?: HTMLDivElement;

  protected readonly email = signal('admin@rescuefood.demo');
  protected readonly motDePasse = signal('Demo1234!');
  protected readonly utilisateur = signal<Utilisateur | null>(null);
  protected readonly chargement = signal(false);
  protected readonly chargementConnexion = signal(false);
  protected readonly erreur = signal('');
  protected readonly filtreStatut = signal('TOUS');
  protected readonly recherche = signal('');
  protected readonly collecteSelectionnee = signal<Collecte | null>(null);
  protected readonly transporteurSelectionne = signal('');
  protected readonly vehicule = signal('');
  protected readonly transporteurs = signal<Transporteur[]>([]);
  protected readonly collectes = signal<Collecte[]>([]);
  protected readonly pointsCarte = signal<PointCarte[]>([]);
  protected readonly dashboard = signal<DashboardResponse>({
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
  });

  protected readonly collectesFiltrees = computed(() => {
    const statut = this.filtreStatut();
    const texte = this.recherche().trim().toLowerCase();
    return this.collectes().filter((collecte) => {
      const correspondStatut = statut === 'TOUS' || collecte.statut === statut;
      const contenu =
        `${collecte.reference} ${collecte.donation?.titre} ${collecte.adresseDepart} ${collecte.adresseArrivee}`.toLowerCase();
      return correspondStatut && (!texte || contenu.includes(texte));
    });
  });

  protected readonly maximumActivite = computed(() =>
    Math.max(1, ...this.dashboard().activite.map(({ livraisons }) => livraisons))
  );
  protected readonly dateDuJour = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date());

  @ViewChild('mapContainer')
  set mapContainer(element: ElementRef<HTMLDivElement> | undefined) {
    this.mapElement = element?.nativeElement;
    if (this.mapElement) {
      window.setTimeout(() => this.initialiserCarte());
    }
  }

  ngOnInit(): void {
    const token = localStorage.getItem('rescuefood_token');
    if (!token) return;

    this.http
      .get<{ user: Utilisateur }>('/api/auth/me', {
        headers: this.entetes(token)
      })
      .subscribe({
        next: ({ user }) => {
          this.utilisateur.set(user);
          this.chargerDonnees();
        },
        error: () => this.deconnexion()
      });
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  protected connexion(): void {
    this.chargementConnexion.set(true);
    this.erreur.set('');
    this.http
      .post<{ accessToken: string; user: Utilisateur }>('/api/auth/login', {
        email: this.email(),
        motDePasse: this.motDePasse()
      })
      .subscribe({
        next: ({ accessToken, user }) => {
          localStorage.setItem('rescuefood_token', accessToken);
          this.utilisateur.set(user);
          this.chargementConnexion.set(false);
          this.chargerDonnees();
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

  protected deconnexion(): void {
    localStorage.removeItem('rescuefood_token');
    this.utilisateur.set(null);
    this.collectes.set([]);
    this.map?.remove();
    this.map = undefined;
  }

  protected chargerDonnees(): void {
    const headers = this.entetes();
    this.chargement.set(true);
    this.erreur.set('');
    const transporteurs =
      this.utilisateur()?.role === 'ADMIN'
        ? this.http.get<{ transporteurs: Transporteur[] }>(
            '/api/logistique/transporteurs',
            { headers }
          )
        : of({ transporteurs: [] });

    forkJoin({
      dashboard: this.http.get<DashboardResponse>(
        '/api/logistique/dashboard',
        { headers }
      ),
      collectes: this.http.get<{ collectes: Collecte[] }>(
        '/api/logistique/collectes?limite=100',
        { headers }
      ),
      carte: this.http.get<{ points: PointCarte[] }>('/api/logistique/carte', {
        headers
      }),
      transporteurs
    }).subscribe({
      next: ({ dashboard, collectes, carte, transporteurs: resultat }) => {
        this.dashboard.set(dashboard);
        this.collectes.set(collectes.collectes);
        this.pointsCarte.set(carte.points);
        this.transporteurs.set(resultat.transporteurs);
        this.chargement.set(false);
        this.mettreAJourCarte();
      },
      error: (error) => {
        this.chargement.set(false);
        if (error.status === 401) {
          this.deconnexion();
          return;
        }
        this.erreur.set(
          error.error?.message || 'Les données logistiques sont indisponibles.'
        );
      }
    });
  }

  protected ouvrirCollecte(collecte: Collecte): void {
    this.collecteSelectionnee.set(collecte);
    this.transporteurSelectionne.set(collecte.transporteur?._id || '');
    this.vehicule.set(collecte.vehicule || '');
  }

  protected fermerCollecte(): void {
    this.collecteSelectionnee.set(null);
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
          this.chargerDonnees();
        },
        error: (error) =>
          this.erreur.set(error.error?.message || 'Assignation impossible.')
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
          this.chargerDonnees();
        },
        error: (error) =>
          this.erreur.set(error.error?.message || 'Mise à jour impossible.')
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
        },
        error: () => this.erreur.set('Le rapport PDF n’a pas pu être généré.')
      });
  }

  protected libelleStatut(statut: string): string {
    const libelles: Record<string, string> = {
      TOUS: 'Toutes',
      A_ASSIGNER: 'À assigner',
      PLANIFIEE: 'Planifiée',
      EN_ROUTE: 'En route',
      COLLECTEE: 'Collectée',
      LIVREE: 'Livrée',
      ANNULEE: 'Annulée'
    };
    return libelles[statut] || statut;
  }

  protected dateCourte(date: string): string {
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

  protected statutsActionnables(collecte: Collecte): string[] {
    if (collecte.statut === 'A_ASSIGNER' && !collecte.transporteur) {
      return collecte.prochainsStatuts.filter((statut) => statut === 'ANNULEE');
    }
    return collecte.prochainsStatuts;
  }

  protected initiales(): string {
    const utilisateur = this.utilisateur();
    return utilisateur
      ? `${utilisateur.prenom?.[0] || ''}${utilisateur.nom?.[0] || ''}`
      : 'RF';
  }

  private entetes(token = localStorage.getItem('rescuefood_token') || '') {
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  private initialiserCarte(): void {
    if (!this.mapElement || this.map) return;

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
