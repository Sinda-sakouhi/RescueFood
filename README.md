# RescueFood

RescueFood est une application de redistribution alimentaire composée de :

- un frontend Angular ;
- une API Node.js/Express ;
- une base MongoDB gérée avec Mongoose.

## Répartition de l'équipe

| Membre | Partie responsable | Branche Git |
|---|---|---|
| **Aziz** | Logistique et dashboard | `feature/logistique-dashboard` |
| **Amal** | Inventaire et catégories | `feature-/inventaires-categorie` |
| **Sinda** | Annonces et matching | `feature/annonces-matching` |

### Aziz — Logistique et dashboard

Gestion des collectes, assignation des transporteurs, suivi des statuts et des
positions GPS, cartographie, indicateurs du dashboard, rapports PDF et
fonctionnalités d'aide à la décision par IA.

### Amal — Inventaire et catégories

Gestion de l'inventaire, des produits, des quantités, des dates de péremption,
des catégories de donations et des opérations CRUD associées.

### Sinda — Annonces et matching

Publication des offres et des demandes, recherche de correspondances,
acceptation ou refus des matchings, conversations entre fournisseurs et ONG,
messagerie et historique des annonces.

## Installation sous Windows

Toutes les commandes suivantes doivent être exécutées dans **PowerShell**.

### 1. Installer les prérequis

Installer :

- [Git pour Windows](https://git-scm.com/download/win)
- [Node.js](https://nodejs.org/) version 24
- [MongoDB Community Server](https://www.mongodb.com/try/download/community)

MongoDB Compass est facultatif, mais utile pour consulter la base
graphiquement.

Vérifier l'installation :

```powershell
git --version
node --version
npm --version
```

### 2. Cloner le projet

```powershell
git clone https://github.com/Sinda-sakouhi/RescueFood.git
Set-Location RescueFood
```

### 3. Installer les dépendances

Depuis la racine `RescueFood` :

```powershell
npm ci
npm ci --prefix backend
npm ci --prefix frontend
```

### 4. Créer le fichier de configuration

```powershell
Copy-Item backend\.env.example backend\.env
```

Le fichier `backend\.env` doit contenir :

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/RescueFood
JWT_SECRET=remplacer-par-un-secret-long-et-aleatoire
JWT_EXPIRES_IN=1h
OSRM_BASE_URL=https://router.project-osrm.org
OSRM_TIMEOUT_MS=4500
OPEN_METEO_BASE_URL=https://api.open-meteo.com
OPEN_METEO_TIMEOUT_MS=3500
```

Le fichier `.env` est privé et ne doit jamais être ajouté à Git.

Pour générer un secret JWT sous PowerShell :

```powershell
[Convert]::ToBase64String(
  [Security.Cryptography.RandomNumberGenerator]::GetBytes(64)
)
```

### 5. Démarrer MongoDB

MongoDB doit fonctionner avant de lancer le backend.

Si MongoDB est installé comme service Windows, ouvrir PowerShell en tant
qu'administrateur et exécuter :

```powershell
Start-Service MongoDB
```

Vérifier que MongoDB écoute sur le port `27017` :

```powershell
Get-NetTCPConnection -LocalPort 27017 -State Listen
```

Dans MongoDB Compass, utiliser cette URI :

```text
mongodb://localhost:27017/RescueFood
```

### 6. Initialiser la base de données

Depuis la racine du projet :

```powershell
npm run seed --prefix backend
```

Cette commande crée les catégories et les données de démonstration :

- 16 utilisateurs ;
- 16 annonces ;
- 7 matchings ;
- 5 conversations et 10 messages ;
- 8 donations ;
- 8 collectes ;
- 3 analyses IA ;
- 1 rapport.

Le seeder peut être relancé sans accumuler les données de démonstration.

### 7. Lancer le projet

Depuis la racine :

```powershell
npm run dev
```

Ouvrir ensuite :

- frontend : <http://localhost:4200>
- backend : <http://localhost:3000>

Pour arrêter les serveurs, utiliser `Ctrl+C`.

## Démarrages séparés

Lancer uniquement le backend :

```powershell
npm run backend
```

Lancer uniquement le frontend :

```powershell
npm run frontend
```

## Commandes utiles

Compiler le frontend :

```powershell
npm run build
```

Vérifier les modèles Mongoose :

```powershell
npm run check:models --prefix backend
```

Recréer les données de démonstration :

```powershell
npm run seed --prefix backend
```

## Référence complète de l'API

URL locale de base :

```text
http://localhost:3000/api
```

Les routes protégées nécessitent cet en-tête :

```text
Authorization: Bearer VOTRE_JWT
```

Toutes les requêtes `POST`, `PUT` ou `PATCH` qui possèdent un corps JSON
doivent également envoyer :

```text
Content-Type: application/json
```

Dans Postman, sélectionner **Body > raw > JSON** et non **Text**. Un corps
envoyé dans un autre format retourne `415`. Un JSON mal formé retourne `400`.

### APIs communes et administration

Ces routes transversales ne sont rattachées à aucune branche métier.

| Méthode | Endpoint | Accès | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | Vérifier que l'API fonctionne |
| `POST` | `/api/auth/register` | Public | Créer un compte en attente |
| `POST` | `/api/auth/login` | Public | Se connecter et recevoir un JWT |
| `GET` | `/api/auth/me` | Authentifié | Consulter son profil |
| `PATCH` | `/api/auth/me` | Authentifié | Modifier son profil |
| `POST` | `/api/auth/logout` | Authentifié | Se déconnecter et révoquer le JWT |
| `GET` | `/api/admin/dashboard` | `ADMIN` | Consulter les statistiques globales |
| `GET` | `/api/admin/users` | `ADMIN` | Lister tous les utilisateurs |
| `PATCH` | `/api/admin/users/:id/access` | `ADMIN` | Modifier le rôle ou le statut d'un compte |

### APIs d'Aziz — Logistique et dashboard

Branche responsable : `feature/logistique-dashboard`.

| Méthode | Endpoint | Accès | Description |
|---|---|---|---|
| `GET` | `/api/logistique/dashboard` | `ADMIN`, `TRANSPORTEUR`, `FOURNISSEUR`, `ONG` | Consulter les KPIs logistiques |
| `GET` | `/api/logistique/carte` | `ADMIN`, `TRANSPORTEUR`, `FOURNISSEUR`, `ONG` | Obtenir les trajets et positions |
| `GET` | `/api/logistique/rapport.pdf` | `ADMIN`, `TRANSPORTEUR`, `FOURNISSEUR`, `ONG` | Télécharger le rapport PDF |
| `GET` | `/api/logistique/transporteurs` | `ADMIN` | Lister les transporteurs et leur charge |
| `POST` | `/api/logistique/ia/itineraire/optimiser` | `ADMIN`, `TRANSPORTEUR` | Optimiser l'ordre des collectes |
| `POST` | `/api/logistique/ml/itineraire/optimiser` | `ADMIN`, `TRANSPORTEUR` | Optimiser avec OSRM et prédire les durées |
| `GET` | `/api/logistique/ml/collectes/:id/contexte-tunisien` | `ADMIN`, `TRANSPORTEUR`, `FOURNISSEUR`, `ONG` | Analyser zone, heure de pointe et météo |
| `GET` | `/api/logistique/ml/collectes/:id/duree-predite` | `ADMIN`, `TRANSPORTEUR`, `FOURNISSEUR`, `ONG` | Prédire la durée réelle d'une collecte |
| `GET` | `/api/logistique/ml/collectes/:id/retard-predit` | `ADMIN`, `TRANSPORTEUR`, `FOURNISSEUR`, `ONG` | Prédire le risque de retard avec le modèle ML |
| `GET` | `/api/logistique/ia/collectes/:id/risque-retard` | `ADMIN`, `TRANSPORTEUR`, `FOURNISSEUR`, `ONG` | Prédire le risque de retard |
| `GET` | `/api/logistique/ia/collectes/:id/transporteurs-recommandes` | `ADMIN` | Classer les transporteurs |
| `GET` | `/api/logistique/collectes` | `ADMIN`, `TRANSPORTEUR`, `FOURNISSEUR`, `ONG` | Lister les collectes accessibles |
| `GET` | `/api/logistique/collectes/:id` | `ADMIN`, `TRANSPORTEUR`, `FOURNISSEUR`, `ONG` | Consulter une collecte |
| `POST` | `/api/logistique/collectes` | `ADMIN` | Planifier une collecte |
| `PATCH` | `/api/logistique/collectes/:id/assignation` | `ADMIN` | Assigner un transporteur |
| `PATCH` | `/api/logistique/collectes/:id/statut` | `ADMIN`, `TRANSPORTEUR` | Faire avancer le workflow |
| `PATCH` | `/api/logistique/collectes/:id/position` | `ADMIN`, `TRANSPORTEUR` | Enregistrer une position GPS |

### APIs d'Amal — Inventaire et catégories

Branche responsable : `feature-/inventaires-categorie`.

| Méthode | Endpoint | Accès | Description |
|---|---|---|---|
| `GET` | `/api/categories` | Public | Lister les catégories de donation |
| `GET` | `/api/categories/:id` | Public | Consulter une catégorie |
| `POST` | `/api/categories` | `ADMIN` | Créer une catégorie |
| `PUT` | `/api/categories/:id` | `ADMIN` | Modifier une catégorie |
| `DELETE` | `/api/categories/:id` | `ADMIN` | Supprimer une catégorie |
| `GET` | `/api/donations` | Authentifié | Lister et filtrer les donations |
| `GET` | `/api/donations/:id` | Authentifié | Consulter une donation |
| `POST` | `/api/donations` | `FOURNISSEUR` | Créer une donation |
| `PUT` | `/api/donations/:id` | `FOURNISSEUR`, `ADMIN` | Modifier une donation |
| `PATCH` | `/api/donations/:id/statut` | `ADMIN`, `ONG`, `TRANSPORTEUR` | Modifier le statut |
| `DELETE` | `/api/donations/:id` | `FOURNISSEUR`, `ADMIN` | Supprimer une donation |

### APIs de Sinda — Annonces et matching

Branche responsable : `feature/annonces-matching`.

| Méthode | Endpoint | Accès | Description |
|---|---|---|---|
| `GET` | `/api/annonces` | Public | Lister les annonces |
| `GET` | `/api/annonces/:id` | Public | Consulter une annonce |
| `GET` | `/api/annonces/suggestion-categorie` | Public | Suggérer une catégorie par mots-clés |
| `GET` | `/api/annonces/user/mes-annonces` | Authentifié | Lister ses annonces |
| `POST` | `/api/annonces` | `FOURNISSEUR`, `ONG` | Publier une offre ou une demande |
| `PATCH` | `/api/annonces/:id` | `FOURNISSEUR`, `ONG` | Modifier sa propre annonce |
| `DELETE` | `/api/annonces/:id` | Auteur, `ADMIN` | Annuler une annonce |
| `GET` | `/api/matchings/suggestions` | `FOURNISSEUR`, `ONG` | Obtenir les correspondances proposées |
| `GET` | `/api/matchings` | Authentifié | Lister ses matchings |
| `POST` | `/api/matchings` | `FOURNISSEUR`, `ONG` | Accepter une correspondance |
| `PATCH` | `/api/matchings/:id/refuser` | `FOURNISSEUR`, `ONG` | Refuser une correspondance |
| `GET` | `/api/conversations` | Authentifié | Lister ses conversations |
| `POST` | `/api/conversations` | Authentifié | Créer une conversation |
| `GET` | `/api/conversations/:id/messages` | Participant | Lire les messages |
| `POST` | `/api/conversations/:id/messages` | Participant | Envoyer un message |
| `PATCH` | `/api/conversations/messages/:id/lu` | Authentifié | Marquer un message comme lu |

### `GET /api/health`

Vérifie que le serveur Express est disponible.

Réponse `200` :

```json
{
  "status": "ok",
  "service": "RescueFood API"
}
```

### `POST /api/auth/register`

Crée un utilisateur avec le statut `EN_ATTENTE`. Le rôle `ADMIN` ne peut pas
être choisi lors d'une inscription publique.

Corps JSON :

```json
{
  "nom": "Trabelsi",
  "prenom": "Nour",
  "email": "nour@example.com",
  "motDePasse": "MotDePasse123!",
  "telephone": "+216 00 000 000",
  "role": "CITOYEN",
  "adresse": "Tunis",
  "localisation": {
    "latitude": 36.8065,
    "longitude": 10.1815
  }
}
```

Rôles publics autorisés :

```text
FOURNISSEUR
ONG
TRANSPORTEUR
CITOYEN
```

Réponses principales :

- `201` : compte créé ;
- `400` : champs ou rôle invalides ;
- `409` : adresse email déjà utilisée.

### `POST /api/auth/login`

Vérifie les identifiants et retourne un JWT si le compte possède le statut
`VALIDE`. La route est limitée à 10 tentatives échouées par adresse IP sur une
période de 15 minutes. Les connexions réussies ne sont pas comptabilisées.

Corps JSON :

```json
{
  "email": "admin@rescuefood.demo",
  "motDePasse": "Demo1234!"
}
```

Réponse `200` :

```json
{
  "message": "Connexion réussie",
  "accessToken": "JWT",
  "tokenType": "Bearer",
  "expiresIn": "1h",
  "dashboardPath": "/admin/dashboard",
  "user": {
    "id": "OBJECT_ID",
    "email": "admin@rescuefood.demo",
    "role": "ADMIN",
    "statutCompte": "VALIDE"
  }
}
```

Chemin retourné selon le rôle :

- `ADMIN` : `/admin/dashboard`
- `FOURNISSEUR` : `/fournisseur/dashboard`
- `ONG` : `/ong/dashboard`
- `TRANSPORTEUR` : `/transporteur/dashboard`
- `CITOYEN` : `/citoyen/dashboard`

Réponses principales :

- `200` : connexion réussie ;
- `400` : identifiants absents ;
- `401` : email ou mot de passe incorrect ;
- `403` : compte en attente, refusé ou suspendu ;
- `429` : trop de tentatives.

### `GET /api/auth/me`

Retourne le profil et le chemin du dashboard de l'utilisateur connecté.

Réponses principales :

- `200` : profil retourné ;
- `401` : JWT absent, invalide, expiré ou révoqué.

### `PATCH /api/auth/me`

Modifie le profil de l'utilisateur connecté.

Champs modifiables :

```text
nom
prenom
telephone
adresse
localisation
avatarUrl
```

Exemple :

```json
{
  "telephone": "+216 11 111 111",
  "avatarUrl": "https://example.com/avatar.jpg"
}
```

Cette route ne permet pas de modifier le rôle, le statut du compte, l'email ou
le mot de passe.

Réponses principales :

- `200` : profil mis à jour ;
- `400` : données invalides ;
- `401` : authentification requise.

### `POST /api/auth/logout`

Incrémente la version de sécurité du compte et révoque les JWT précédemment
émis pour cet utilisateur.

Réponses principales :

- `200` : déconnexion réussie ;
- `401` : authentification requise.

### `GET /api/admin/dashboard`

Route réservée au rôle `ADMIN`. Elle retourne :

- le nombre total d'utilisateurs ;
- les utilisateurs regroupés par rôle ;
- les utilisateurs regroupés par statut ;
- le nombre de donations ;
- le nombre d'annonces ;
- le nombre de collectes.

Réponses principales :

- `200` : statistiques retournées ;
- `401` : JWT absent ou invalide ;
- `403` : utilisateur non administrateur.

### `GET /api/admin/users`

Route réservée au rôle `ADMIN`. Retourne tous les utilisateurs, triés du plus
récent au plus ancien. Le mot de passe n'est jamais retourné.

Réponses principales :

- `200` : liste retournée ;
- `401` : JWT absent ou invalide ;
- `403` : utilisateur non administrateur.

### `PATCH /api/admin/users/:id/access`

Route réservée au rôle `ADMIN`. Modifie le rôle et/ou le statut du compte
désigné par `:id`.

Corps JSON :

```json
{
  "role": "FOURNISSEUR",
  "statutCompte": "VALIDE"
}
```

Rôles autorisés :

```text
ADMIN
FOURNISSEUR
ONG
TRANSPORTEUR
CITOYEN
```

Statuts autorisés :

```text
EN_ATTENTE
VALIDE
REFUSE
SUSPENDU
```

Toute modification révoque les anciens JWT de l'utilisateur concerné. Un
administrateur ne peut pas retirer son propre accès administrateur.

Réponses principales :

- `200` : accès mis à jour ;
- `400` : identifiant, rôle ou statut invalide ;
- `401` : JWT absent ou invalide ;
- `403` : utilisateur non administrateur ;
- `404` : utilisateur introuvable.

## API catégories et donations

### Catégories

`GET /api/categories` et `GET /api/categories/:id` sont publics. Les opérations
`POST`, `PUT` et `DELETE` nécessitent un JWT administrateur.

Exemple de réponse `200` :

```json
{
  "categories": [
    {
      "_id": "OBJECT_ID",
      "nom": "Fruits et légumes",
      "description": "Fruits, légumes et produits frais",
      "typeProduit": "FRUITS_LEGUMES",
      "prioriteRedistribution": "ELEVEE",
      "dureeConservationEstimee": 5
    }
  ]
}
```

Corps de création :

```json
{
  "nom": "Produits frais",
  "description": "Fruits et légumes à redistribuer rapidement",
  "typeProduit": "FRUITS_LEGUMES",
  "prioriteRedistribution": "ELEVEE",
  "dureeConservationEstimee": 5
}
```

`PUT /api/categories/:id` accepte les mêmes champs de manière optionnelle.
Réponses principales : `200`, `201`, `400`, `401`, `403`, `404`, `409`.

### Donations

Toutes les routes `/api/donations` nécessitent un JWT. La liste accepte les
filtres `statut`, `urgence`, `categorie`, `fournisseur`, `beneficiaire`, `page`
et `limit`.

`POST /api/donations` est réservé au fournisseur :

```json
{
  "titre": "Lot de pains frais",
  "description": "Pains non vendus de la journée",
  "categorieDonation": "OBJECT_ID",
  "compositionLot": "10 baguettes et 5 pains complets",
  "quantiteEstimee": 15,
  "unite": "UNITE",
  "poidsTotalKg": 5.5,
  "images": ["https://example.com/pains.jpg"],
  "temperatureStockage": 20,
  "conditionsStockage": "Conserver au sec",
  "urgence": "ELEVEE",
  "dateDisponibilite": "2026-06-13T18:00:00.000Z",
  "dateLimiteCollecte": "2026-06-14T10:00:00.000Z",
  "adresseCollecte": "12 rue de Marseille, Tunis",
  "localisationCollecte": {
    "latitude": 36.8037,
    "longitude": 10.1811
  }
}
```

`PUT /api/donations/:id` modifie une donation. `PATCH
/api/donations/:id/statut` accepte un statut parmi `CREE`,
`EN_ATTENTE_VALIDATION`, `VALIDE`, `RESERVE`, `EN_COLLECTE`, `LIVRE` et
`ANNULE`. Une donation en collecte ou déjà livrée ne peut pas être supprimée.

Réponses principales : `200`, `201`, `400`, `401`, `403`, `404`.

## API annonces, matching et messagerie

Sauf pour la lecture publique des annonces, les routes suivantes nécessitent
l'en-tête `Authorization: Bearer VOTRE_JWT`.

### Annonces

`GET /api/annonces` accepte les paramètres optionnels `type`, `categorie` et
`statut` (`ACTIVE` par défaut). `GET /api/annonces/:id` retourne le détail
d'une annonce. `GET /api/annonces/user/mes-annonces` retourne les annonces de
l'utilisateur connecté.

`POST /api/annonces` permet à un fournisseur de publier une `OFFRE` et à une
ONG de publier une `DEMANDE`. Si la catégorie est absente, elle est suggérée
par mots-clés. L'urgence est calculée à partir de la date d'expiration.

```json
{
  "type": "OFFRE",
  "titre": "Surplus de légumes",
  "description": "Cagettes disponibles aujourd'hui",
  "categorieDonation": "OBJECT_ID",
  "quantiteEstimee": 20,
  "unite": "KG",
  "urgence": "ELEVEE",
  "adresse": "Marché central, Tunis",
  "localisation": {
    "latitude": 36.7982,
    "longitude": 10.1706
  },
  "dateExpiration": "2026-06-14T18:00:00.000Z"
}
```

`PATCH /api/annonces/:id` accepte les champs modifiables `titre`,
`description`, `quantiteEstimee`, `unite`, `urgence`, `adresse`,
`localisation` et `dateExpiration`. `DELETE /api/annonces/:id` conserve
l'historique et passe le statut à `ANNULEE`.

Exemple de réponse de création :

```json
{
  "message": "Annonce publiée avec succès",
  "annonce": {
    "_id": "OBJECT_ID",
    "type": "OFFRE",
    "statut": "ACTIVE"
  },
  "ia": {
    "urgenceCalculee": "ELEVEE",
    "raison": "Expiration proche"
  }
}
```

`GET /api/annonces/suggestion-categorie?titre=...&description=...` retourne la
catégorie suggérée et sa fiche lorsqu'elle existe. Le paramètre `titre` est
obligatoire.

Réponses principales : `200`, `201`, `400`, `403`, `404`.

### Matching automatique

`GET /api/matchings/suggestions` calcule les correspondances selon la
catégorie, la distance, la quantité et l'urgence. `GET /api/matchings` retourne
les matchings associés aux annonces de l'utilisateur.

`POST /api/matchings` accepte :

```json
{
  "offreId": "OBJECT_ID",
  "demandeId": "OBJECT_ID"
}
```

La route crée ou accepte le matching, passe les annonces à `MATCHEE` et crée
une conversation entre le fournisseur et l'ONG. La réponse `201` contient
`matching` et `conversation`.

`PATCH /api/matchings/:id/refuser` ne nécessite pas de corps. Il passe le
matching à `REFUSE` et remet les annonces à `ACTIVE`.

Réponses principales : `200`, `201`, `400`, `403`, `404`, `409`.

### Conversations et messages

`GET /api/conversations` liste les conversations actives de l'utilisateur.
`POST /api/conversations` crée une conversation ou retourne celle qui existe
déjà :

```json
{
  "annonceId": "OBJECT_ID",
  "destinataireId": "OBJECT_ID"
}
```

`GET /api/conversations/:id/messages` retourne les messages et les marque
comme lus pour le participant connecté. Pour envoyer un message :

```http
POST /api/conversations/:id/messages
```

```json
{
  "contenu": "Nous pouvons organiser la collecte à 14 heures."
}
```

`PATCH /api/conversations/messages/:id/lu` marque explicitement un message
comme lu. Seuls les participants peuvent consulter ou publier dans une
conversation.

Réponses principales : `200`, `201`, `400`, `403`, `404`.

## API logistique

Toutes les routes `/api/logistique` nécessitent un JWT. Un transporteur ne voit
que ses collectes, un fournisseur celles qu'il expédie et une ONG celles qu'elle
reçoit. L'administrateur voit l'ensemble du réseau.

Le workflow autorisé est :

```text
A_ASSIGNER -> PLANIFIEE -> EN_ROUTE -> COLLECTEE -> LIVREE
```

Une collecte peut être annulée avant sa livraison. Chaque changement est ajouté
à `historiqueStatuts`. Les positions GPS sont conservées dans
`historiquePositions` avec un maximum de 250 points.

### `GET /api/logistique/dashboard`

Retourne les KPIs, la répartition par statut, l'activité des sept derniers jours
et les alertes pour les collectes en retard ou sans transporteur.

Exemple de réponse :

```json
{
  "kpis": {
    "collectesTotal": 3,
    "collectesActives": 1,
    "livraisonsTerminees": 1,
    "poidsLivreKg": 12.5,
    "dureeMoyenneMinutes": 60,
    "tauxPonctualite": 100
  },
  "parStatut": {
    "A_ASSIGNER": 1,
    "PLANIFIEE": 0,
    "EN_ROUTE": 1,
    "COLLECTEE": 0,
    "LIVREE": 1,
    "ANNULEE": 0
  },
  "activite": [],
  "alertes": []
}
```

### `GET /api/logistique/collectes`

Paramètres optionnels :

```text
statut
recherche
dateDebut
dateFin
page
limite
```

La réponse contient `collectes`, `pagination` et, pour chaque collecte,
`prochainsStatuts`.

### `POST /api/logistique/collectes`

Crée une collecte depuis une donation `VALIDE` ou `RESERVE` ayant déjà un
bénéficiaire. La distance et la durée sont estimées automatiquement.

```json
{
  "donationId": "OBJECT_ID",
  "dateCollectePrevue": "2026-06-14T09:00:00.000Z",
  "dateLivraisonPrevue": "2026-06-14T10:00:00.000Z",
  "transporteurId": "OBJECT_ID_OPTIONNEL",
  "vehicule": "Fourgon frigorifique 12"
}
```

Réponses principales : `201`, `400`, `404`, `409`.

### `PATCH /api/logistique/collectes/:id/assignation`

```json
{
  "transporteurId": "OBJECT_ID",
  "vehicule": "Fourgon frigorifique 12"
}
```

L'utilisateur ciblé doit être un `TRANSPORTEUR` avec un compte `VALIDE`.
Réponses principales : `200`, `400`, `404`, `409`.

### `PATCH /api/logistique/collectes/:id/statut`

```json
{
  "statut": "EN_ROUTE",
  "note": "Départ confirmé par le transporteur"
}
```

Les transitions hors workflow retournent `409` avec `prochainsStatuts`. Le
statut de la donation passe à `EN_COLLECTE`, `LIVRE` ou revient à `VALIDE`
selon l'étape.

### `PATCH /api/logistique/collectes/:id/position`

Disponible uniquement pour une collecte `EN_ROUTE` ou `COLLECTEE`.

```json
{
  "latitude": 36.8071,
  "longitude": 10.1764
}
```

Réponses principales : `200`, `400`, `404`, `409`.

### Carte, transporteurs et rapport

- `GET /api/logistique/carte` retourne les départs, arrivées, positions
  courantes, statuts et transporteurs.
- `GET /api/logistique/transporteurs` retourne les transporteurs validés et
  leur nombre de collectes actives.
- `GET /api/logistique/rapport.pdf` produit un fichier PDF contenant les 100
  dernières collectes accessibles à l'utilisateur.

### IA logistique explicable

Ces fonctionnalités utilisent des scores multicritères déterministes. Elles ne
prétendent pas être un modèle entraîné sur un grand historique : chaque score
est explicable, testable et pourra ensuite être remplacé par un modèle ML.

La version ML ajoute une deuxième couche dans `backend/utils/logistiqueIA.js` :

- OSRM calcule des distances et durées routières réelles quand Internet est
  disponible ;
- Open-Meteo ajoute un contexte météo réel sans clé API ;
- une approximation locale associe les coordonnées à une zone du Grand Tunis
  et applique des créneaux de pointe typiques : matin, soir et vendredi midi ;
- un modèle de régression locale prédit la durée réelle selon la durée routière,
  l'heure de collecte, le jour, l'urgence, la charge du transporteur, sa
  ponctualité, la zone et la météo ;
- si OSRM ne répond pas, l'API revient automatiquement à l'optimisation locale
  pour que la démonstration reste utilisable.

Variables optionnelles :

```env
OSRM_BASE_URL=https://router.project-osrm.org
OSRM_TIMEOUT_MS=4500
OPEN_METEO_BASE_URL=https://api.open-meteo.com
OPEN_METEO_TIMEOUT_MS=3500
```

Pour une précision réelle en production, le modèle doit être réentraîné avec
des historiques locaux : collectes tunisiennes, heures de pointe tunisiennes,
durées réelles, retards, quartiers, météo ou jours spéciaux. Pour une première
démonstration, il peut fonctionner avec des coefficients de départ et les
routes OpenStreetMap d'OSRM, mais ses prédictions seront moins précises qu'un
modèle entraîné sur Tunis.

Les zones tunisiennes intégrées sont une approximation de démonstration :
Centre-ville Tunis, Lac et Berges du Lac, Ariana, Ben Arous et La Marsa. Elles
servent à expliquer le modèle, pas à remplacer une vraie base de trafic.

#### `POST /api/logistique/ia/itineraire/optimiser`

L'administrateur fournit un transporteur. Le transporteur connecté utilise
automatiquement son propre identifiant.

```json
{
  "transporteurId": "OBJECT_ID",
  "collecteIds": ["OBJECT_ID_OPTIONNEL"],
  "positionDepart": {
    "latitude": 36.8065,
    "longitude": 10.1815
  }
}
```

L'algorithme construit l'ordre des missions actives par itérations :

- proximité avec le prochain départ : 45 % ;
- urgence alimentaire : 35 % ;
- proximité de l'échéance : 20 %.

```json
{
  "methode": "Scoring glouton explicable",
  "distanceInitialeKm": 18.4,
  "distanceOptimiseeKm": 14.1,
  "gainDistanceKm": 4.3,
  "dureeEstimeeMinutes": 35,
  "ordreOptimise": [
    {
      "ordre": 1,
      "collecteId": "OBJECT_ID",
      "reference": "COL-DEMO-001",
      "titre": "Cagettes de tomates",
      "score": 91,
      "distanceApprocheKm": 2.1
    }
  ]
}
```

#### `GET /api/logistique/ia/collectes/:id/risque-retard`

Le risque est calculé à partir de la marge avant livraison, du dépassement de
l'heure prévue, de la ponctualité historique, de la charge du transporteur et
de l'ancienneté de sa dernière position GPS.

```json
{
  "collecteId": "OBJECT_ID",
  "reference": "COL-DEMO-001",
  "methode": "Scoring de risque explicable",
  "analyse": {
    "score": 0.72,
    "pourcentage": 72,
    "niveau": "CRITIQUE",
    "margeMinutes": -18,
    "raisons": [
      "Livraison prédite après l’échéance",
      "3 missions actives"
    ]
  }
}
```

Les niveaux sont `FAIBLE` en dessous de 40 %, `ATTENTION` à partir de 40 % et
`CRITIQUE` à partir de 70 %.

#### `GET /api/logistique/ia/collectes/:id/transporteurs-recommandes`

Cette route administrateur classe les transporteurs validés pour une collecte
`A_ASSIGNER` ou `PLANIFIEE` :

- proximité du point de collecte : 35 % ;
- disponibilité selon les missions actives : 30 % ;
- ponctualité historique : 25 % ;
- expérience selon les livraisons terminées : 10 %.

```json
{
  "methode": "Classement multicritère explicable",
  "recommandations": [
    {
      "transporteur": {
        "id": "OBJECT_ID",
        "nom": "Sami Logistique Solidaire"
      },
      "score": 0.89,
      "pourcentage": 89,
      "distanceKm": 2.4,
      "criteres": {
        "proximite": 0.92,
        "disponibilite": 1,
        "ponctualite": 0.96,
        "experience": 0.8
      },
      "raisons": [
        "2.4 km du point de collecte",
        "0 mission(s) active(s)",
        "96% de ponctualité"
      ]
    }
  ]
}
```

#### `POST /api/logistique/ml/itineraire/optimiser`

Cette route utilise OSRM pour obtenir de vraies distances routières. Elle
optimise l'ordre des points de collecte avec OSRM Trip, puis prédit une durée
réelle pour chaque mission.

```json
{
  "transporteurId": "OBJECT_ID",
  "collecteIds": ["OBJECT_ID_OPTIONNEL"],
  "positionDepart": {
    "latitude": 36.8065,
    "longitude": 10.1815
  }
}
```

Exemple de réponse :

```json
{
  "methode": "OSRM Trip + modele ML de duree",
  "sourceRouting": "OSRM",
  "modele": "Regression lineaire locale v1",
  "distanceInitialeKm": 18.4,
  "distanceOptimiseeKm": 12.7,
  "gainDistanceKm": 5.7,
  "dureeRouteMinutes": 31,
  "polyline": "encoded_polyline",
  "ordreOptimise": [
    {
      "ordre": 1,
      "collecteId": "OBJECT_ID",
      "reference": "COL-DEMO-001",
      "titre": "Cagettes de tomates",
      "dureePrediteMinutes": 36,
      "prediction": {
        "modele": "Regression lineaire locale v1",
        "donneesEntrainement": "Coefficients initialises pour demo, remplacables par historique tunisien",
        "dureeRoutiereMinutes": 31,
        "ecartMinutes": 5
      }
    }
  ]
}
```

Si OSRM est indisponible, `sourceRouting` vaut `FALLBACK_LOCAL` et la réponse
contient `raisonFallback`.

#### `GET /api/logistique/ml/collectes/:id/contexte-tunisien`

Retourne les facteurs locaux utilisés par le modèle ML : zone de départ,
zone d'arrivée, heure de pointe tunisienne, météo Open-Meteo et pénalité de
contexte.

```json
{
  "collecte": {
    "id": "OBJECT_ID",
    "reference": "COL-DEMO-001",
    "titre": "Cagettes de tomates"
  },
  "contexte": {
    "zoneDepart": {
      "nom": "Centre-ville Tunis",
      "congestion": 0.85,
      "description": "Hyper-centre, nombreuses intersections et stationnement difficile"
    },
    "zoneArrivee": {
      "nom": "Lac et Berges du Lac",
      "congestion": 0.65
    },
    "heurePointe": {
      "heurePointe": true,
      "type": "POINTE_MATIN"
    },
    "meteo": {
      "source": "Open-Meteo",
      "precipitationMm": 0.4,
      "ventKmh": 22,
      "pluie": true,
      "ventFort": false,
      "penalite": 0.14
    },
    "penaliteContexte": 0.42
  }
}
```

Si Open-Meteo est indisponible, `meteo.source` vaut `Fallback local` et la
prédiction continue sans bloquer la démonstration.

#### `GET /api/logistique/ml/collectes/:id/duree-predite`

Prédit la durée réelle d'une collecte à partir du modèle local.

```json
{
  "collecte": {
    "id": "OBJECT_ID",
    "reference": "COL-DEMO-001",
    "titre": "Cagettes de tomates"
  },
  "prediction": {
    "modele": "Regression lineaire locale v1",
    "dureePrediteMinutes": 38,
    "dureeRoutiereMinutes": 31,
    "ecartMinutes": 7,
    "caracteristiques": {
      "heurePointe": true,
      "weekend": false,
      "urgenceElevee": true,
      "collectesActivesTransporteur": 2,
      "ponctualiteTransporteur": 0.8,
      "distanceRouteKm": 8.4,
      "zoneDepart": "Centre-ville Tunis",
      "congestionZone": 0.85,
      "pluie": true,
      "ventFort": false,
      "meteoSource": "Open-Meteo"
    }
  }
}
```

#### `GET /api/logistique/ml/collectes/:id/retard-predit`

Convertit la durée prédite en risque de retard.

```json
{
  "prediction": {
    "modele": "Regression lineaire locale v1",
    "score": 0.72,
    "pourcentage": 72,
    "niveau": "CRITIQUE",
    "margeMinutes": -12,
    "dureePrediteMinutes": 38,
    "raisons": [
      "Duree ML predite apres l echeance",
      "Transporteur deja charge"
    ]
  }
}
```

### Modèle `Collecte`

Le modèle contient notamment : `reference`, `donation`, `transporteur`,
`fournisseur`, `beneficiaire`, `statut`, `priorite`, les adresses et
coordonnées, la distance, la durée estimée, les dates prévues et réelles,
`vehicule`, `positionActuelle`, `historiquePositions`, `historiqueStatuts` et
`itineraireOptimise`.

### Fichiers backend de la partie d'Aziz

Le code logistique contient des commentaires explicatifs avant les fonctions
principales afin de faciliter sa lecture et sa présentation :

| Fichier | Responsabilité |
|---|---|
| `backend/routes/logistiqueRoutes.js` | Routes HTTP et permissions par rôle |
| `backend/controllers/logistiqueController.js` | Contrôleurs des APIs logistiques, dashboard, carte et PDF |
| `backend/models/Collecte.js` | Schéma MongoDB d'une mission de collecte |
| `backend/utils/logistique.js` | Workflow, distance GPS et estimation de durée |
| `backend/utils/logistiqueIA.js` | Optimisation, risque de retard et recommandation |
| `backend/test/logistique.test.js` | Tests unitaires de la logique métier et IA |

Ordre conseillé pour présenter le code :

```text
routes -> contrôleur -> modèle -> utilitaires métier -> IA -> tests
```

### Comptes de démonstration

Exemples :

```text
admin@rescuefood.demo
marche.centre@rescuefood.demo
boulangerie.soleil@rescuefood.demo
grossiste.nord@rescuefood.demo
hotel.lac@rescuefood.demo
solidarite@rescuefood.demo
entraide@rescuefood.demo
coeur.tunis@rescuefood.demo
espoir.ariana@rescuefood.demo
transport@rescuefood.demo
leila.transport@rescuefood.demo
karim.express@rescuefood.demo
noura.froid@rescuefood.demo
mehdi.livraison@rescuefood.demo
ines.mobile@rescuefood.demo
citoyen@rescuefood.demo
```

Mot de passe commun :

```text
Demo1234!
```

Le seeder enrichi crée 16 annonces, 7 matchings, 5 conversations, 8 donations
et 8 collectes. Les six comptes transporteurs possèdent des positions et des
charges différentes afin de démontrer le classement IA. Le compte
`noura.froid@rescuefood.demo` possède deux missions actives pour tester
l'optimisation d'une tournée multi-collectes.

### Interface de démonstration multi-rôles

Le frontend propose un sélecteur de compte sur la page de connexion. Chaque
rôle affiche uniquement les modules qui lui sont autorisés :

- administrateur : utilisateurs, accès, statistiques et toute la logistique ;
- fournisseur : offres, matching, messagerie et suivi de ses collectes ;
- ONG : demandes, matching, messagerie et suivi des livraisons ;
- transporteur : missions, changements de statut et position GPS ;
- citoyen : annonces publiques, profil et diagnostic.

Les écrans couvrent les APIs actuellement exposées : authentification,
administration, catégories, annonces, matching, messagerie et logistique. Les
routes CRUD des catégories et donations sont également disponibles dans le
backend et signalées dans le diagnostic. Une page frontend dédiée à la gestion
de l'inventaire reste à connecter à ces routes.

## Règle obligatoire de documentation

Toute modification du projet doit mettre à jour ce README dans le même commit
si elle change :

- une API, même interne ;
- une route, une méthode HTTP ou un préfixe ;
- un corps de requête ou une réponse ;
- un rôle, une permission ou un statut HTTP ;
- une variable d'environnement ;
- un script npm ;
- une collection ou un modèle MongoDB ;
- une procédure d'installation ou de lancement.

Une nouvelle API n'est pas considérée comme terminée tant qu'elle n'est pas
ajoutée à la section **Référence complète de l'API**.

### Prompt obligatoire pour une IA

Copier ce prompt au début de toute demande faite à une IA qui doit modifier ou
générer du code dans ce dépôt :

```text
Tu travailles sur le projet RescueFood.

Avant de modifier le code, lis le README.md et respecte les conventions du
projet.

Après chaque modification :
1. Mets à jour README.md dans le même changement.
2. Si tu ajoutes, modifies ou supprimes une API, documente obligatoirement :
   - la méthode HTTP ;
   - l'URL complète ;
   - les rôles autorisés ;
   - les en-têtes nécessaires ;
   - les paramètres et le corps JSON ;
   - un exemple de réponse ;
   - les principaux statuts HTTP et erreurs.
3. Mets également à jour les variables d'environnement, scripts npm, modèles
   MongoDB, commandes d'installation et données de démonstration concernés.
4. Vérifie le README par rapport au code réel avant de terminer.
5. Ne considère jamais la tâche comme terminée si le code et le README ne sont
   pas synchronisés.
```

Mettre à jour le projet depuis GitHub :

```powershell
git pull origin main
npm ci
npm ci --prefix backend
npm ci --prefix frontend
```

## Structure du projet

```text
RescueFood/
|-- backend/
|   |-- config/
|   |-- models/
|   |-- seeders/
|   |-- .env.example
|   `-- server.js
|-- frontend/
|   `-- src/
|-- package.json
`-- README.md
```

## Collections MongoDB

- `users`
- `categoriedonations`
- `annonces`
- `matchings`
- `conversations`
- `messages`
- `donations`
- `collectes`
- `iaanalyses`
- `rapports`

## Résolution des problèmes sous Windows

### MongoDB ne démarre pas

Vérifier si le service existe :

```powershell
Get-Service MongoDB
```

Puis le démarrer dans un PowerShell administrateur :

```powershell
Start-Service MongoDB
```

### Le port `3000` est déjà utilisé

Identifier le processus :

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen
```

Modifier ensuite `PORT` dans `backend\.env` et la cible correspondante dans
`frontend\proxy.conf.json`.

### Le port `4200` est déjà utilisé

Identifier le processus :

```powershell
Get-NetTCPConnection -LocalPort 4200 -State Listen
```

### Les collections ne sont pas visibles dans Compass

Exécuter le seeder puis actualiser la base `RescueFood` :

```powershell
npm run seed --prefix backend
```
