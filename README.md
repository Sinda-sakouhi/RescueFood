# RescueFood

RescueFood est une application de redistribution alimentaire composée de :

- un frontend Angular ;
- une API Node.js/Express ;
- une base MongoDB gérée avec Mongoose.

## Prérequis

Installer les outils suivants avant de commencer :

- Git ;
- Node.js 24 et npm ;
- MongoDB Community Server.

MongoDB Compass est facultatif. Il permet seulement de consulter graphiquement
la base de données.

## 1. Cloner le projet

```bash
git clone https://github.com/Sinda-sakouhi/RescueFood.git
cd RescueFood
```

## 2. Installer les dépendances

Exécuter les trois commandes depuis la racine du projet :

```bash
npm ci
npm ci --prefix backend
npm ci --prefix frontend
```

`npm ci` utilise les fichiers `package-lock.json` afin que tous les membres de
l'équipe installent les mêmes versions.

## 3. Configurer le backend

Créer `backend/.env` à partir du fichier d'exemple.

Sous Windows PowerShell :

```powershell
Copy-Item backend/.env.example backend/.env
```

Sous Linux ou macOS :

```bash
cp backend/.env.example backend/.env
```

Configuration locale par défaut :

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/RescueFood
```

Ne jamais ajouter `backend/.env` à Git.

## 4. Démarrer MongoDB

Le serveur MongoDB doit fonctionner sur le port `27017` avant de lancer
l'application.

Sous Windows, si MongoDB est installé comme service :

```powershell
Start-Service MongoDB
```

Sous Linux avec `systemd` :

```bash
sudo systemctl start mongod
```

Connexion facultative depuis MongoDB Compass :

```text
mongodb://localhost:27017/RescueFood
```

## 5. Initialiser les données

Depuis la racine du projet :

```bash
npm run seed --prefix backend
```

Cette commande crée :

- 7 catégories de donation ;
- 7 utilisateurs de démonstration ;
- 3 donations ;
- 2 collectes ;
- 3 analyses IA ;
- 1 rapport.

Le seeder peut être relancé sans accumuler les données de démonstration. Les
comptes factices utilisent le domaine `@rescuefood.demo`.

## 6. Lancer l'application

Depuis la racine :

```bash
npm run dev
```

Cette commande démarre simultanément :

- le frontend : <http://localhost:4200>
- le backend : <http://localhost:3000>

Arrêter les serveurs avec `Ctrl+C`.

## Commandes utiles

```bash
# Lancer uniquement le backend
npm run backend

# Lancer uniquement le frontend
npm run frontend

# Compiler le frontend
npm run build

# Vérifier les imports des modèles Mongoose
npm run check:models --prefix backend

# Réinitialiser les données de démonstration
npm run seed --prefix backend
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

## Modèle de données

Les collections MongoDB sont :

- `users`
- `categoriedonations`
- `donations`
- `collectes`
- `iaanalyses`
- `rapports`

Une donation représente directement un lot alimentaire. Elle contient sa
composition, sa quantité, ses photos et ses conditions de stockage. Il
n'existe donc pas de collection `produits`.

Les analyses de vision par ordinateur référencent une donation. Leur résultat
peut être :

- `ACCEPTE`
- `CONTROLE_HUMAIN_REQUIS`
- `REFUSE`

L'analyse visuelle ne remplace pas le contrôle humain ni les règles de sécurité
alimentaire.

## Résolution des problèmes

### MongoDB ne se connecte pas

Vérifier que MongoDB est démarré et écoute sur le port `27017` :

```powershell
Get-NetTCPConnection -LocalPort 27017 -State Listen
```

Vérifier ensuite la valeur de `MONGODB_URI` dans `backend/.env`.

### Le port est déjà utilisé

Modifier `PORT` dans `backend/.env`. Si le port du backend change, modifier
également la cible dans `frontend/proxy.conf.json`.

### Les collections ne sont pas visibles dans Compass

Actualiser la base `RescueFood` après avoir exécuté :

```bash
npm run seed --prefix backend
```
