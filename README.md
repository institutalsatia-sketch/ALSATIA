# CRM Institut Alsatia 🏛️

Application de gestion de la relation donateurs, événements et communication interne pour l'Institut Alsatia et ses entités (Herrade de Landsberg, Louis et Zélie Martin, Academia Alsatia).

## 🎨 Identité Visuelle (Codes Couleurs)
- **Institut Alsatia** : `#262f78` (Bleu Institutionnel)
- **Primaire Herrade de Landsberg** : `#b40000` (Rouge)
- **Collège Louis et Zélie Martin** : `#044634` (Vert)
- **Academia Alsatia** : `#ffbd59` (Jaune Or)

## 🚀 Stack Technique
- **Frontend** : Next.js / React (Optimisé mobile & desktop)
- **Backend** : [Supabase](https://supabase.com/) (PostgreSQL + Auth)
- **Déploiement** : GitHub + Vercel (ou Netlify)
- **Emails & Com** : Brevo (via API)
- **Dons** : HelloAsso (Synchronisation prévue)

## 🏗️ Structure de la Base de Données (Supabase)
L'application repose sur les tables principales suivantes :
- `profiles` : Gestion des utilisateurs internes et rôles.
- `donors` : Fiches 360° (Particuliers/Entreprises, Liens de parenté, Paroisses).
- `events` : Inscriptions et pointage pour les conférences et fêtes.
- `comments` : Messagerie interne contextuelle (système de commentaires).
- `tasks` : Actions à faire et suivi des urgences.

## 🛠️ Installation & Configuration

1. **Cloner le projet**
   ```bash
   git clone [https://github.com/votre-compte/alsatia-crm.git](https://github.com/votre-compte/alsatia-crm.git)
