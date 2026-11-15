# 🏗️ Calculateur de la Méthode Forfaitaire (Béton Armé)

Une application web interactive développée en **HTML**, **CSS** et **JavaScript** permettant d'automatiser le calcul des moments fléchissants et des efforts tranchants d'une poutre continue selon la **méthode forfaitaire** (règles BAEL).

---

## 📋 Table des matières
- [À propos du projet](#-à-propos-du-projet)
- [Fonctionnalités](#-fonctionnalités)
- [Conditions d'application de la méthode](#-conditions-dapplication-de-la-méthode)
- [Technologies utilisées](#-technologies-utilisées)
- [Installation et utilisation](#-installation-et-utilisation)
- [Structure du projet](#-structure-du-projet)
- [Captures d'écran](#-captures-décran)
- [Auteur](#-auteur)

---

## 🎯 À propos du projet

En génie civil, le dimensionnement des poutres continues en béton armé nécessite la détermination précise des sollicitations (moments en travée, moments sur appuis et efforts tranchants). 

Ce programme permet aux étudiants et ingénieurs en génie civil d'obtenir rapidement ces résultats sans erreur de calcul manuel, en vérifiant automatiquement l'éligibilité de la structure à la méthode forfaitaire.

---

## ✨ Fonctionnalités

- **Vérification automatique des conditions** : Contrôle des 4 conditions réglementaires du BAEL (rapport des charges Q ≤ 2G et Q ≤ 5 kN/m², inertie constante, rapport des portées successives entre 0,8 et 1,25, fissuration peu préjudiciable).
- **Calcul des moments isostatiques (M₀)** : Détermination automatique pour chaque travée.
- **Calcul des moments sur appuis (\(M_w\), \(M_e\))** : Application des coefficients forfaitaires selon le nombre de travées et la position de l'appui.
- **Calcul des moments en travée (\(M_t\))** : Respect des inégalités fondamentales de la méthode forfaitaire (prise en compte du coefficient α).
- **Calcul des efforts tranchants (V)** : Évaluation forfaitaire ou par la méthode RDM selon les cas.
- **Interface intuitive** : Saisie dynamique du nombre de travées, des portées et des charges permanentes (G) et d'exploitation (Q).

---

## 📐 Conditions d'application de la méthode

Pour rappel, le programme vérifie les critères suivants avant d'appliquer les formules forfaitaires :
1. La méthode s'applique aux planchers à charge d'exploitation modérée : \(Q \le \max(2G ; 5\text{ kN/m}^2)\).
2. Les moments d'inertie des sections transversales sont identiques le long de la poutre.
3. Les portées successives sont dans un rapport compris entre 0,8 et 1,25 (\(0,8 \le \frac{L_i}{L_{i+1}} \le 1,25\)).
4. La fissuration est considérée comme **peu préjudiciable (FPP)**.

*(Note : Si l'une de ces conditions n'est pas respectée, le programme affiche un avertissement recommandant l'utilisation de la méthode de Caquot).*

---

## 🛠️ Technologies utilisées

* **HTML5** : Structure sémantique de l'application et formulaires de saisie.
* **CSS3** : Mise en page moderne et responsive (Flexbox / Grid).
* **JavaScript (ES6+)** : Logique de calcul, manipulation du DOM et validation des données.

---

## 🚀 Installation et utilisation

Aucune installation de serveur ou de dépendance n'est requise pour exécuter ce projet.

1. **Cloner le dépôt** (ou télécharger le dossier ZIP) :
   ```bash
   git clone https://github.com[votre-nom-utilisateur]/[nom-du-depot].git
   ```
2. **Ouvrir le projet** :
   Rendez-vous dans le dossier du projet et double-cliquez simplement sur le fichier `index.html` pour l'ouvrir dans votre navigateur web préféré (Chrome, Firefox, Edge, etc.).
3. **Lancer un calcul** :
   - Renseignez le nombre de travées de votre poutre.
   - Entrez les longueurs de travées (L), les charges permanentes (G) et les charges d'exploitation (Q).
   - Cliquez sur le bouton **"Calculer"** pour afficher les résultats détaillés.

---

## 📂 Structure du projet

```text
├── index.html          # Page principale et interface utilisateur
├── style.css           # Feuille de style (design, mise en page, responsive)
├── script.js           # Algorithmes de la méthode forfaitaire et gestion des événements
└── README.md           # Documentation du projet
```

---


---

## 👤 Auteur

* **biloa philemon** - *Développement et algorithmes de génie civil*
* GitHub : [@votre-pseudo](https://github.comvotre-pseudo)
