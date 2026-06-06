# RescueFood

Application web anti-gaspillage composée de :

- `frontend/` : Angular
- `backend/` : Express.js avec MongoDB et Mongoose

## Installation

Les dépendances sont déjà déclarées dans chaque partie du projet :

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

## Développement

Lancer le frontend et le backend ensemble :

```bash
npm run dev
```

- Frontend : <http://localhost:4200>
- Backend Express : <http://localhost:3000>

## MongoDB

Le backend utilise la connexion locale suivante, définie dans `backend/.env` :

```env
MONGODB_URI=mongodb://127.0.0.1:27017/RescueFood
```

MongoDB doit être lancé avant le backend. Dans MongoDB Compass, vous pouvez
utiliser `mongodb://localhost:27017/` comme URI ; le champ `Name` est seulement
un libellé pour la connexion Compass.

Les modèles Mongoose se trouvent dans `backend/models/`. Pour insérer ou
mettre à jour les catégories de donation de base :

```bash
npm run seed:categories --prefix backend
```

Pour vérifier que tous les modèles sont importables :

```bash
npm run check:models --prefix backend
```

Pour insérer toutes les données de démonstration :

```bash
npm run seed --prefix backend
```

Le seeder de démonstration peut être relancé sans accumuler de doublons. Les
comptes factices utilisent le domaine `@rescuefood.demo`.

Les donations contiennent directement leurs informations alimentaires
(catégorie, description et poids). Il n’existe pas de collection `produits`.

Chaque donation décrit également son lot avec sa composition, sa quantité,
ses images et ses conditions de stockage. Les résultats de vision par
ordinateur sont enregistrés dans `iaanalyses` et référencent la donation
analysée. Une décision IA indique si le lot est accepté, refusé ou doit être
contrôlé par une personne.

## Autres commandes

```bash
npm run frontend
npm run backend
npm run build
```
