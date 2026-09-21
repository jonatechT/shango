# Écarts frontend ↔ backend à corriger

Ce document liste, fonctionnalité par fonctionnalité, ce que le frontend Angular attend réellement (code actuel, pas les anciens docs `BACKEND_API_CONTRACT.md`/`FRONTEND_ARCHITECTURE.md` qui décrivent une API jamais implémentée) et ce que le backend fournit aujourd'hui. Chaque section indique un correctif concret à apporter côté Laravel.

**Déjà OK et vérifié en conditions réelles** : `POST /api/login`, `GET /api/me`, `POST /api/logout` (Sanctum). Aucune action requise ici.

---

## 1. Création d'équipement — ✅ entièrement branché (2026-09-17)

Le frontend envoie maintenant directement ce que le backend attend (plus besoin de dériver `organization_id` côté backend ni de rendre `device_id`/`reference` nullable) :

```json
{
  "organization_id": 4,
  "type": "Kit solaire",
  "reference": "SH-014",
  "device_id": "SH-014",
  "status": "actif"
}
```

- `organization_id` : structure de l'utilisateur connecté (le frontend la connaît déjà via son token, pas besoin que le backend la déduise).
- `reference` : l'ID métier généré par le frontend (ex. "SH-014").
- `device_id` **= l'« ID du boîtier SHANGO »** saisi/généré dans le formulaire (confirmé avec l'équipe : c'est le vrai identifiant que le boîtier physique utilisera pour ses envois, pas un simple libellé).
- `status` : `"actif"` par défaut à la création ; l'état réel viendra de la télémétrie IoT.

Testé en conditions réelles (login admin → `POST /api/equipements`) : ✅ 201, équipement bien créé.

**Mise à jour (2026-09-17)** : `GET /api/equipements` (liste) est aussi branché — le tableau du parc d'équipement charge maintenant la vraie liste backend (partagée entre tous les postes) au lieu du cache local uniquement. Testé en conditions réelles.

**Mise à jour (2026-09-17, plus tard le même jour)** : migration `add_frontend_fields_to_equipements_table` appliquée — `nom`, `description`, `client_nom`, `client_numero`, `marque_modele`, `site`, `perimetre_metres` sont désormais envoyés par le frontend et bien persistés. Testé en conditions réelles (création avec tous les champs → 201, tout est bien enregistré et renvoyé).

**Mise à jour (2026-09-17, upload de photo)** : ✅ entièrement branché — le backend valide maintenant `photo` comme une vraie image (`image|mimes:jpg,jpeg,png,webp|max:5120`, stockée via `Storage::disk('public')`). Le frontend envoie la photo en `multipart/form-data` (au lieu de JSON) quand un fichier est sélectionné, et construit l'URL publique de la photo (`/storage/{chemin}`) à partir de la réponse. Testé en conditions réelles : upload multipart → 201 → fichier bien accessible via `GET /storage/equipements/xxx.png`.

⚠️ **Point d'exploitation à ne pas oublier** : le lien symbolique `public/storage` (requis pour que les photos uploadées soient servies publiquement) n'existait pas sur cette machine — il a fallu lancer `php artisan storage:link` manuellement. Ce lien n'est pas versionné par git (c'est un symlink créé localement) : **à refaire sur tout nouvel environnement/déploiement** (serveur de prod inclus), sinon les photos uploadées renverront une 404.

---

## 2. Diagnostic batterie — branché sur l'historique réel, reste les champs

**Mise à jour (2026-09-17)** : plus besoin d'endpoint "dernier diagnostic" dédié — le frontend appelle directement `GET /api/batteries/{device_id}/diagnostics` (déjà existant) et prend le premier élément (le plus récent) comme "diagnostic actuel". Testé en conditions réelles (200 OK, liste vide gérée proprement pour un device sans historique).

Champs attendus par le frontend sur un diagnostic, comparés au modèle `PredictionBatterie` :

| Frontend attend | Backend a | Écart |
|---|---|---|
| `voltage_v`, `current_a`, `temperature_c`, `dod_percent` | idem | OK |
| `soh_pourcent` | `soh_pourcent` | OK |
| `capacite_restante_ah` | `capacite_ah` | nom différent |
| `duree_estimee_jours` | `rul_jours` | nom différent |
| `etat` | `etat` | OK |
| `message` | — | absent |
| `humidite_pourcent` | — | absent sur `predictions_batteries` (diagnostic IA) |
| `statut_paiement` | — | absent sur `predictions_batteries` (diagnostic IA) |

→ Reste à ajouter `message` (et éventuellement `humidite_pourcent`/`statut_paiement`) sur `predictions_batteries` si besoin un jour côté diagnostic IA, et à harmoniser `capacite_ah`→`capacite_restante_ah` / `rul_jours`→`duree_estimee_jours`.

**Mise à jour (2026-09-18)** : `humidite` et `statut_paiement` sont maintenant fournis en télémétrie temps réel (pas via le diagnostic IA) — colonne `telemetries.humidite` ajoutée (migration `2026_09_18_130000_add_humidite_to_telemetries_table`, `TelemetrieController::store` + `Telemetrie::$fillable` mis à jour), `statut_paiement` existait déjà sur `telemetries`. Le frontend affiche maintenant les cartes Courant/Température/Tension/Humidité/Statut paiement de la fiche équipement depuis `GET /api/equipements/{id}/telemetries` (dernière entrée), avec rafraîchissement automatique toutes les 8s, au lieu du diagnostic batterie IA (qui reste une fonctionnalité séparée, lancée manuellement).

---

## 3. Blocage/déblocage d'un équipement — ✅ branché (2026-09-17)

Le frontend utilise `PUT /api/equipements/{id}` avec `{ "etat_kit": "BLOQUE" | "MARCHE" }`. Testé en conditions réelles : persiste bien en base.

**Point encore à vérifier côté backend** : ces routes (`update` équipement) sont actuellement réservées à `role:superadmin,admin` — si un **technicien** doit pouvoir bloquer/débloquer son propre équipement, il faut soit l'ajouter à ce groupe de rôles pour cette action précise, soit exposer une route dédiée technicien-only limitée au champ `etat_kit`.

---

## 4. Alertes — vocabulaire à harmoniser

Backend (`Alerte`) : `type_alerte` limité à l'enum `CHOC|SURCHAUFFE|TENSION_FAIBLE|MOUVEMENT|BOITIER_OUVERT`, `gravite` à 3 niveaux `FAIBLE|MOYENNE|ELEVEE`.

Le frontend (pages Alertes/Maintenance) manipule des libellés plus riches et en texte libre : "Violation de box", "Déplacement non autorisé", "Charge trop lente", "Niveau carburant faible", "Température moteur élevée", "Tension anormale", "Niveau batterie faible"... et une sévérité à 2 niveaux seulement (`Critique` / `Avertissement`).

Cette partie n'est pas encore branchée sur une vraie API (tout est mocké), donc rien n'est bloquant aujourd'hui, mais avant de la brancher il faudra décider ensemble :
- soit étendre l'enum `type_alerte` pour couvrir tous les cas gérés par le frontend,
- soit passer `type_alerte` en chaîne libre côté backend et laisser le frontend gérer son propre vocabulaire ;
- et mapper `gravite` (3 niveaux) ↔ `Critique/Avertissement` (2 niveaux) dans un sens ou dans l'autre.

---

## 5. Maintenance — écart le plus large, à planifier

Backend (`Maintenance`) : un seul technicien assigné (`assigned_to`), `type` limité à `preventive|corrective`, `status` = `demandee|validee|planifiee|en_cours|terminee`.

Le frontend (fonctionnalités ajoutées récemment : affectation multi-techniciens, planification avec plusieurs "natures", rapport d'intervention) attend :
- **plusieurs techniciens affectés** par intervention (`affectes: {id, nom}[]`) — nécessite une table pivot `maintenance_technicien` (many-to-many), le `assigned_to` unique actuel ne suffit pas.
- **plusieurs natures** d'intervention par ligne (`natures: string[]`) au lieu d'un `type` unique preventive/corrective.
- une **sévérité** (`Critique`/`Avertissement`) — absente du modèle `Maintenance`.
- un **rapport d'intervention** structuré : contenu, date de rédaction, rédacteur, pièces remplacées, durée, + un volet "conformité" (inspection réalisée oui/non, équipement conforme oui/non/na, commentaire). Rien d'équivalent côté backend — nécessite une nouvelle table `rapports_intervention` (ou des colonnes JSON sur `maintenances`).
- un **délai imparti** et une **description libre** à l'affectation.

Recommandation : traiter ça comme un chantier à part, une fois qu'on aura confirmé le modèle de données avec toi — c'est la partie la plus structurante restante.

---

## 6. Organisations ("Structures" côté frontend) — ✅ RÉGLÉ (2026-09-17)

`Organization` a maintenant `name`, `code`, `description`, `email`, `phone`, `address`, `city`, `country`, `status` (migration `2026_09_17_100641_add_contact_fields_to_organizations_table`). Le frontend (`structure.service.ts`) envoie et lit désormais tous ces champs. Vérifié en conditions réelles : création d'une organisation avec tous les champs → tout est bien persisté et renvoyé par l'API.

Reste noté pour mémoire, non bloquant : `Organization.status` est en anglais (`active`/`inactive`) alors que `User.status`/`Equipement.status` sont en français (`actif`/`inactif`) — à harmoniser un jour si vous voulez de la cohérence, mais le frontend gère déjà cette différence.

---

## 7. Comptes utilisateurs — inscription libre non supportée

Le frontend a un écran d'inscription libre (`/register`) où un utilisateur choisit sa structure et se retrouve en attente de validation par l'admin (statut `PENDING`). **Aucun équivalent backend** :
- pas de `POST /api/auth/register` (endpoint public de création de compte),
- pas de 3ᵉ valeur de statut "en attente" (`User.status` ne connaît que `actif`/`inactif`),
- pas d'endpoint pour qu'un admin valide/rejette une demande.

Si vous voulez garder ce flux, il faut ces 3 éléments côté backend. Sinon, il faudra qu'on supprime/désactive cet écran côté frontend et que la création de compte se fasse uniquement via un admin (`POST /api/users`, déjà existant).

---

## 8. Blocage physique du boîtier — le bouton frontend n'agit PAS sur l'appareil réel (2026-09-18)

Constat fait en testant le blocage/déblocage pendant une session IoT réelle :

Le bouton "Bloquer/Débloquer" du frontend appelle `PUT /api/equipements/{id}` avec `etat_kit` — ça change **uniquement la base de données**. Il existe une route **séparée et actuellement inutilisée par le frontend**, `POST /api/commande` (`CommandeController::store`), qui elle est conçue pour transmettre une vraie commande physique : elle appelle `BridgeService::envoyerCommande()`, qui fait un `POST {SHANGO_BRIDGE_URL}/commande` avec le header `X-API-Key` (`SHANGO_BRIDGE_API_KEY`) — c'est-à-dire que **c'est le backend qui doit pouvoir joindre le Bridge IoT**, à l'inverse du sens de communication utilisé pour la télémétrie/alertes (bridge → backend).

Deux choses bloquent cette fonctionnalité aujourd'hui :
1. `SHANGO_BRIDGE_URL` et `SHANGO_BRIDGE_API_KEY` sont **vides** dans `.env` — jamais configurés.
2. Pour que ça marche, le Bridge IoT doit lui-même exposer un serveur HTTP accessible (route `/commande`, protégée par `X-API-Key`) — ce qui veut dire que la machine de l'expert IoT doit aussi être joignable depuis notre backend (son propre tunnel, symétrique au nôtre).

**Point de conception à trancher avec l'équipe** : un bouton poussoir physique sur le boîtier peut aussi changer `etat_kit` de son propre chef (en envoyant `POST /api/status`, déjà fonctionnel). Il n'y a aujourd'hui **aucun arbitrage** entre une commande manuelle de l'admin (via `/api/commande` une fois branché) et l'état auto-rapporté par l'appareil : le dernier écrit gagne, sans priorité définie. À décider : le bouton physique doit-il pouvoir annuler un blocage admin, ou l'admin doit-il avoir le dernier mot (et pendant combien de temps) ?

**Pour rendre le blocage frontend réellement effectif sur l'appareil**, il faut : (1) que l'expert IoT expose son bridge via un tunnel/URL joignable, (2) configurer `SHANGO_BRIDGE_URL`/`SHANGO_BRIDGE_API_KEY` avec cette URL, (3) faire appeler `POST /api/commande` par le bouton frontend (à la place de, ou en plus de, l'actuel `PUT /api/equipements/{id}`).

---

## 9. Alertes automatiques en doublon — corrigé (2026-09-18)

`AlerteDetectionService::detecter()` créait une **nouvelle** alerte `TENSION_FAIBLE`/`SURCHAUFFE` à **chaque télémétrie** où le seuil était dépassé, sans vérifier si une alerte du même type était déjà active. Résultat observé en test réel avec le bridge IoT : 703 alertes `TENSION_FAIBLE` créées en ~2h (une par télémétrie, envoyées toutes les ~10s, tension restée sous le seuil de 10V en continu).

**Correctif** : `creerAlerte()` vérifie maintenant qu'aucune alerte du même `type_alerte` n'est déjà `nouvelle`/`en_cours` pour cet équipement avant d'en créer une nouvelle — une condition qui persiste ne génère plus qu'une seule alerte active, jusqu'à ce qu'elle soit résolue/ignorée. Testé en conditions réelles (le compteur ne bouge plus tant que l'alerte reste active).

⚠️ **Point d'exploitation** : le process `php artisan serve` doit être **redémarré** pour prendre en compte tout changement de code PHP côté service/contrôleur — contrairement à ce qu'on pourrait attendre du serveur de dev intégré, un cache opcode semble persister sur cette machine tant que le process tourne (constaté ici : l'édition du fichier n'a eu aucun effet tant que le process n'a pas été relancé).

⚠️ **Note pour plus tard** : les 703 alertes de test déjà créées avant ce correctif restent en base (`statut: nouvelle`) — à nettoyer/marquer résolues avant la mise en prod si besoin.

---

## Résumé priorisé

1. ~~**Création + liste d'équipement**~~ (§1) — ✅ entièrement branché et testé, y compris tous les champs (nom, description, client, marque, site, périmètre).
2. ~~**Diagnostic batterie**~~ (§2) — ✅ branché sur l'historique réel.
3. ~~**Blocage équipement (base de données)**~~ (§3) — ✅ branché ; reste à vérifier si les techniciens doivent y avoir accès. **Blocage physique réel de l'appareil** : voir §8, non branché.
4. ~~**Organisations**~~ (§6) — ✅ branché et testé.
5. ~~**Télémétrie temps réel (courant/tension/température/humidité/statut paiement)**~~ — ✅ branché et affiché sur la fiche équipement (2026-09-18), avec rafraîchissement automatique.
6. **Maintenance** (§5) et **Alertes** (§4, affichage lecture seule déjà branché en 2026-09-18, mais le workflow d'affectation/planification reste mocké) — gros chantiers de modélisation, à planifier ensemble avant de coder.
7. **Inscription libre** (§7) — à trancher : on la garde (3 nouveaux éléments backend) ou on la retire du frontend.
8. **Commande physique du boîtier (blocage réel)** (§8) — nécessite un tunnel côté Bridge IoT + configuration `SHANGO_BRIDGE_URL`.
9. **Reste non bloquant** : `message` sur `predictions_batteries` (§2) ; upload de photo d'équipement (§1, déjà fonctionnel).
