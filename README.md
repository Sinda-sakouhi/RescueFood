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
```

Le fichier `.env` est privé et ne doit jamais être ajouté à Git.

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
