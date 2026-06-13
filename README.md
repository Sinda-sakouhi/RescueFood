# RescueFood

RescueFood est une application de redistribution alimentaire composée de :

- un frontend Angular ;
- une API Node.js/Express ;
- une base MongoDB gérée avec Mongoose.

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

- 7 utilisateurs ;
- 4 annonces ;
- 1 matching automatique ;
- 1 conversation et 2 messages ;
- 3 donations ;
- 2 collectes ;
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

### Résumé des endpoints

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
| `GET` | `/api/categories` | Public | Lister toutes les catégories de dons |
| `GET` | `/api/categories/:id` | Public | Détails d'une catégorie de dons |
| `POST` | `/api/categories` | `ADMIN` | Créer une catégorie de dons |
| `PUT` | `/api/categories/:id` | `ADMIN` | Modifier une catégorie de dons |
| `DELETE` | `/api/categories/:id` | `ADMIN` | Supprimer une catégorie de dons |
| `GET` | `/api/donations` | Authentifié | Lister les dons (avec filtres) |
| `GET` | `/api/donations/:id` | Authentifié | Détails d'un don |
| `POST` | `/api/donations` | `FOURNISSEUR` | Créer un don |
| `PUT` | `/api/donations/:id` | `FOURNISSEUR`, `ADMIN` | Modifier un don |
| `PATCH` | `/api/donations/:id/statut` | `ADMIN`, `ONG`, `TRANSPORTEUR` | Changer le statut d'un don |
| `DELETE` | `/api/donations/:id` | `FOURNISSEUR`, `ADMIN` | Supprimer un don |

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
`VALIDE`. La route est limitée à 10 tentatives par période de 15 minutes.

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

### `GET /api/categories`

Retourne toutes les catégories de dons disponibles, triées par type de produit.

Réponse `200` :

```json
{
  "categories": [
    {
      "_id": "OBJECT_ID",
      "nom": "Fruits et légumes",
      "description": "Fruits, légumes et produits végétaux frais.",
      "typeProduit": "FRUITS_LEGUMES",
      "prioriteRedistribution": "ELEVEE",
      "dureeConservationEstimee": 5,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### `GET /api/categories/:id`

Retourne les détails d'une catégorie spécifique.

Réponses principales :

- `200` : catégorie retournée ;
- `400` : identifiant invalide ;
- `404` : catégorie introuvable.

### `POST /api/categories`

Route réservée au rôle `ADMIN`. Crée une nouvelle catégorie de dons.

Corps JSON :

```json
{
  "nom": "Produits frais",
  "description": "Description de la catégorie",
  "typeProduit": "FRUITS_LEGUMES",
  "prioriteRedistribution": "ELEVEE",
  "dureeConservationEstimee": 5
}
```

Types de produits autorisés :

```text
FRUITS_LEGUMES
PAIN_VIENNOISERIE
PRODUITS_LAITIERS
PLATS_PREPARES
CONSERVES
BOISSONS
AUTRE
```

Réponses principales :

- `201` : catégorie créée ;
- `400` : données invalides ;
- `401` : authentification requise ;
- `403` : utilisateur non administrateur ;
- `409` : type de produit déjà utilisé.

### `PUT /api/categories/:id`

Route réservée au rôle `ADMIN`. Modifie une catégorie existante.

Corps JSON (tous les champs optionnels) :

```json
{
  "nom": "Nouveau nom",
  "description": "Nouvelle description",
  "prioriteRedistribution": "MOYENNE",
  "dureeConservationEstimee": 7
}
```

Réponses principales :

- `200` : catégorie mise à jour ;
- `400` : identifiant ou données invalides ;
- `401` : authentification requise ;
- `403` : utilisateur non administrateur ;
- `404` : catégorie introuvable.

### `DELETE /api/categories/:id`

Route réservée au rôle `ADMIN`. Supprime une catégorie.

Réponses principales :

- `200` : catégorie supprimée ;
- `400` : identifiant invalide ;
- `401` : authentification requise ;
- `403` : utilisateur non administrateur ;
- `404` : catégorie introuvable.

### `GET /api/donations`

Retourne la liste des dons avec pagination et filtres.

Paramètres de requête (optionnels) :

```text
statut: CREE, EN_ATTENTE_VALIDATION, VALIDE, RESERVE, EN_COLLECTE, LIVRE, ANNULE
urgence: FAIBLE, MOYENNE, ELEVEE
categorie: ObjectId de la catégorie
fournisseur: ObjectId du fournisseur
beneficiaire ObjectId du bénéficiaire
page: numéro de page (défaut: 1)
limit: nombre par page (défaut: 20)
```

Réponse `200` :

```json
{
  "donations": [
    {
      "_id": "OBJECT_ID",
      "titre": "Lot de fruits frais",
      "description": "Description du don",
      "fournisseur": {
        "_id": "OBJECT_ID",
        "email": "fournisseur@example.com",
        "nom": "Dupont",
        "prenom": "Jean"
      },
      "beneficiaire": null,
      "categorieDonation": {
        "_id": "OBJECT_ID",
        "nom": "Fruits et légumes",
        "typeProduit": "FRUITS_LEGUMES"
      },
      "statut": "CREE",
      "urgence": "ELEVEE",
      "dateDisponibilite": "2024-01-01T00:00:00.000Z",
      "dateLimiteCollecte": "2024-01-02T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### `GET /api/donations/:id`

Retourne les détails complets d'un don avec toutes les relations.

Réponses principales :

- `200` : don retourné ;
- `400` : identifiant invalide ;
- `401` : authentification requise ;
- `404` : don introuvable.

### `POST /api/donations`

Route réservée au rôle `FOURNISSEUR`. Crée un nouveau don.

Corps JSON :

```json
{
  "titre": "Lot de pains frais",
  "description": "Pains de la journée non vendus",
  "categorieDonation": "OBJECT_ID",
  "compositionLot": "10 baguettes, 5 pains complets",
  "quantiteEstimee": 15,
  "unite": "UNITE",
  "poidsTotalKg": 5.5,
  "images": ["https://example.com/image1.jpg", "https://example.com/image2.jpg"],
  "temperatureStockage": 20,
  "conditionsStockage": "Garder à température ambiante",
  "urgence": "ELEVEE",
  "dateDisponibilite": "2024-01-01T18:00:00.000Z",
  "dateLimiteCollecte": "2024-01-02T10:00:00.000Z",
  "adresseCollecte": "123 Rue de la Boulangerie, Paris",
  "localisationCollecte": {
    "latitude": 48.8566,
    "longitude": 2.3522
  }
}
```

Unités autorisées :

```text
KG, G, L, UNITE, PORTION
```

Réponses principales :

- `201` : don créé ;
- `400` : données invalides ;
- `401` : authentification requise ;
- `403` : utilisateur non fournisseur ;
- `404` : catégorie introuvable.

### `PUT /api/donations/:id`

Route réservée aux rôles `FOURNISSEUR` et `ADMIN`. Modifie un don existant.

Corps JSON (tous les champs optionnels) :

```json
{
  "titre": "Nouveau titre",
  "description": "Nouvelle description",
  "urgence": "MOYENNE",
  "quantiteEstimee": 20
}
```

Réponses principales :

- `200` : don mis à jour ;
- `400` : identifiant ou données invalides ;
- `401` : authentification requise ;
- `403` : accès non autorisé ;
- `404` : don ou catégorie introuvable.

### `PATCH /api/donations/:id/statut`

Route réservée aux rôles `ADMIN`, `ONG` et `TRANSPORTEUR`. Modifie le statut d'un don.

Corps JSON :

```json
{
  "statut": "VALIDE"
}
```

Statuts autorisés :

```text
CREE
EN_ATTENTE_VALIDATION
VALIDE
RESERVE
EN_COLLECTE
LIVRE
ANNULE
```

Réponses principales :

- `200` : statut mis à jour ;
- `400` : identifiant ou statut invalide ;
- `401` : authentification requise ;
- `403` : accès non autorisé ;
- `404` : don introuvable.

### `DELETE /api/donations/:id`

Route réservée aux rôles `FOURNISSEUR` et `ADMIN`. Supprime un don.

Impossible de supprimer un don avec le statut `EN_COLLECTE` ou `LIVRE`.

Réponses principales :

- `200` : don supprimé ;
- `400` : identifiant invalide ou don non supprimable ;
- `401` : authentification requise ;
- `403` : accès non autorisé ;
- `404` : don introuvable.

### Comptes de démonstration

Exemples :

```text
admin@rescuefood.demo
marche.centre@rescuefood.demo
solidarite@rescuefood.demo
transport@rescuefood.demo
```

Mot de passe commun :

```text
Demo1234!
```

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
