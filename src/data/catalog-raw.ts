// Catalogue partagé de départ (~280 articles).
// Format : "Nom|rayon|unité|format|prix démo €|drapeaux|conservation j|allergènes|alias|mois"
// drapeaux : L = produit en Belgique, B = existe en bio, P = périssable, S = fond de placard, C = courant (mise en place rapide)
// allergènes : gl gluten, la lait, oe œufs, po poisson, fc fruits à coque, so soja, cr crustacés
export const CATALOG_RAW = `
Riz arborio|ep|g|1000|3.49|B|||risotto|
Asperges vertes|fl|g|500|4.99|LBP|5||asperges|4-6
Oignon|fl|pc|8|1.69|LBC|60||oignons,oignon jaune|1-12
Bouillon de légumes|ep|ml|6000|1.49|BS||gl|bouillon,cube bouillon|
Parmesan|fr|g|200|4.29|BP|30|la|parmigiano|
Lardons|vi|g|200|2.49|LP|7||lardons fumés|
Petits pois|su|g|1000|2.29|LB|||petits pois surgelés|
Pâte brisée|fr|pc|1|1.59|P|21|gl,la||
Épinards frais|fl|g|400|2.49|LBP|4||epinards|3-5,9-11
Oeufs|fr|pc|12|3.79|LBPC|28|oe|œufs,oeuf,œuf|
Crème fraîche|fr|ml|200|1.39|LBP|10|la|creme fraiche,crème|
Saumon fumé|vi|g|200|5.99|P|10|po||
Fromage de chèvre|fr|g|150|2.79|LBP|14|la|chèvre,buche de chevre|
Carottes|fl|g|1000|1.29|LBPC|21||carotte|1-12
Navets|fl|g|1000|1.99|LBP|14||navet|10-3
Pommes de terre grenaille|fl|g|750|2.29|LBP|30||grenailles|5-8
Concentré de tomate|ep|g|140|0.89|BS|||concentre de tomates|
Épaule d'agneau en morceaux|vi|g|1000|18.90|P|3||agneau|
Pois chiches (boîte)|ep|g|400|0.99|B|||pois chiches|
Pâtes courtes|ep|g|500|0.99|B||gl|penne,fusilli,macaroni|
Radis|fl|pc|20|1.49|LBP|7||botte de radis|4-7
Ciboulette|fl|pc|1|1.29|LP|7|||
Yaourt nature|fr|g|500|1.19|LBP|21|la|yaourt|
Filet de poulet|vi|g|600|7.49|LBP|3||blanc de poulet,poulet,escalope de poulet|
Mozzarella|fr|g|125|0.99|BP|14|la||
Nouilles chinoises|ep|g|250|1.49|||gl,oe|nouilles|
Pois mange-tout|fl|g|200|2.49|P|5||mange-tout|5-8
Oignons nouveaux|fl|pc|6|1.29|LP|7||oignon nouveau,oignons verts|4-8
Sauce soja|ep|ml|250|2.19|S||so,gl|soja|
Pommes de terre|fl|g|2500|3.49|LBPC|30||patates,pdt,pomme de terre|1-12
Salade verte|fl|pc|1|1.19|LBP|5||laitue,salade|4-10
Pain de campagne|bo|pc|16|2.69|BP|4|gl|pain|
Ricotta|fr|g|250|1.99|P|7|la||
Roquette|fl|g|125|1.79|BP|4|||
Jambon cru|vi|pc|8|3.49|P|10||jambon d'ardenne,jambon sec|
Lait|fr|ml|1000|1.05|LBC|60|la|lait demi-écrémé,lait entier|
Persil|fl|pc|1|1.19|LP|7||persil plat|
Haricots verts|fl|g|500|2.99|LBP|5||haricots verts frais|6-9
Dos de cabillaud|vi|g|400|9.99|P|2|po|cabillaud|
Halloumi|fr|g|225|3.49|P|30|la||
Courgettes|fl|g|1000|2.49|LBP|7||courgette|6-9
Aubergine|fl|g|500|1.99|LBP|7||aubergines|7-9
Poivron|fl|pc|3|1.99|BP|10||poivrons|7-9
Tomates|fl|g|1000|2.99|LBP|7||tomate|6-9
Semoule|ep|g|1000|1.79|B||gl|couscous|
Cuisse de poulet|vi|pc|4|4.99|LP|3||cuisses de poulet|
Concombre|fl|pc|1|0.99|LBP|7|||5-9
Oignon rouge|fl|pc|4|1.49|BP|30||oignons rouges|
Olives noires|ep|g|150|1.69|||||
Pain pita|bo|pc|6|1.49|P|7|gl|pita|
Brochettes de porc|vi|g|500|6.49|LP|3|||
Feta|fr|g|200|2.29|BP|21|la||
Pâtes|ep|g|1000|1.69|BC||gl|pates|
Pesto|ep|g|190|2.49|||la,fc|pesto basilic|
Tomates cerises|fl|g|250|1.99|LBP|7|||6-9
Basilic|fl|pc|1|1.29|LP|5|||
Thon (boîte)|ep|g|160|1.99|||po|thon|
Houmous|fr|g|200|1.99|P|7|||
Herbes de Provence|ep|g|30|1.29|S||||
Côtelettes d'agneau|vi|pc|6|9.99|P|3|||
Boulgour|ep|g|500|1.89|B||gl|boulghour|
Menthe|fl|pc|1|1.29|LP|5|||
Citron|fl|pc|4|1.49|BP|21||citrons|
Falafels|su|pc|12|2.99|||gl||
Grosses tomates|fl|pc|4|2.49|LP|7||tomates à farcir|6-9
Riz|ep|g|1000|1.69|BC|||riz long|
Haché porc et bœuf|vi|g|500|4.49|LP|2||haché porc-boeuf,hache mixte|
Tortillas|ep|pc|8|1.69|||gl|wraps|
Avocat|fl|pc|2|1.99|BP|5||avocats|
Maïs (boîte)|ep|g|300|0.89|||maïs,mais|
Haricots rouges (boîte)|ep|g|400|0.79|B|||haricots rouges|
Potiron|fl|g|1500|2.49|LBP|30||potimarron,courge|9-12
Pain de mie|bo|pc|20|1.39|P|7|gl||
Emmental|fr|g|200|2.19|P|30|la|emmental râpé,fromage râpé|
Jambon|vi|pc|10|2.99|LP|7||jambon cuit,jambon blanc|
Champignons de Paris|fl|g|500|2.29|LBP|5||champignons|1-12
Chou-fleur|fl|g|1000|2.29|LBP|7||chou fleur|6-11
Béchamel|ep|ml|500|1.59|||la,gl|sauce béchamel|
Échalote|fl|pc|10|1.79|LB|60||échalotes|
Saucisse|vi|pc|4|4.29|LP|3||saucisses|
Beurre|fr|g|250|2.79|LBC|60|la||
Haché de bœuf|vi|g|500|5.99|LBP|2||haché boeuf,viande hachée|
Cerneaux de noix|ep|g|100|2.29|||fc|noix|
Patate douce|fl|g|1000|2.99|BP|21||patates douces|9-3
Lait de coco|ep|ml|400|1.49|B||||
Curry en poudre|ep|g|50|1.29|S|||curry|
Riz basmati|ep|g|1000|2.49|B|||basmati|
Pâte feuilletée|fr|pc|1|1.49|P|21|gl,la||
Poireaux|fl|g|1000|2.29|LBP|10||poireau|9-4
Comté|fr|g|200|3.99|P|30|la||
Lentilles corail|ep|g|500|1.99|B|||lentilles rouges|
Cumin|ep|g|40|1.29|S||||
Feuilles de lasagne|ep|g|500|1.49|||gl,oe|lasagnes|
Sauce tomate|ep|ml|500|1.49|B|||passata,coulis de tomate|
Courge butternut|fl|g|1200|1.99|LBP|30||butternut|9-12
Bière brune|bs|ml|330|1.29|L||gl||
Pain d'épices|bo|pc|12|2.29|L||gl|peperkoek|
Moutarde|ep|g|370|1.29|LS|||moutarde de dijon|
Cassonade|ep|g|500|1.49|LS|||sucre brun|
Bœuf à braiser|vi|g|1000|13.90|LP|3||carbonnade,boeuf|
Lentilles vertes|ep|g|500|1.79|B|||lentilles|
Chicons|fl|pc|8|2.49|LBP|7||chicon,endives,endive|10-4
Gruyère râpé|fr|g|200|2.29|P|30|la|gruyère|
Chou vert|fl|g|1000|1.79|LBP|14||chou frisé,chou|10-3
Saucisse fumée|vi|pc|2|3.49|LP|14|||
Haricots blancs (boîte)|ep|g|400|0.85|B|||haricots blancs|
Baguette|bo|pc|1|0.99|P|2|gl||
Reblochon|fr|pc|1|6.99|P|21|la||
Tomates concassées|ep|g|400|0.69|B|||tomates en boîte,tomates pelées|
Épices chili|ep|g|40|1.29|S||||
Céleri|fl|g|500|1.49|LBP|10||céleri branche|9-3
Spaghetti|ep|g|500|0.99|B||gl|spaghettis|
Dés de jambon|vi|g|150|1.79|P|10||allumettes de jambon|
Tofu fumé|fr|g|200|2.49|BP|21|so||
Épices fajitas|ep|g|40|1.29|S||||
Sirop de Liège|ep|g|450|2.99|LS|||sirop de pommes|
Galettes végétales|su|pc|4|3.49|||so,gl|burger végétal|
Salade romaine|fl|pc|1|1.49|LBP|7||romaine|5-10
Croûtons|ep|g|100|1.29|||gl||
Sauce César|ep|ml|250|2.49|||oe,la,po||
Petites pâtes|ep|g|500|0.99|||gl|vermicelles|
Brocoli|fl|g|500|1.79|LBP|7||brocolis|6-11
Pavé de saumon|vi|g|500|9.99|P|2|po|saumon|
Tofu ferme|fr|g|400|2.79|BP|21|so|tofu|
Pommes|fl|g|1500|2.49|LBPC|30||pomme,jonagold|9-5
Poires|fl|g|1000|2.29|LBP|21||poire,conférence|9-3
Bananes|fl|g|1000|1.79|BPC|6||banane|
Oranges|fl|g|2000|2.99|BP|21||orange|
Clémentines|fl|g|1500|2.99|BP|14||mandarines,clementine|11-2
Kiwis|fl|pc|6|1.99|BP|14||kiwi|
Fraises|fl|g|500|3.49|LP|3||fraise|5-7
Raisin|fl|g|500|2.49|BP|7||raisins|8-10
Ail|fl|pc|3|1.29|BS|60||gousse d'ail,tête d'ail|
Gingembre|fl|g|200|1.49|B|21|||
Mâche|fl|g|150|1.99|LP|5|||10-3
Betterave cuite|fl|g|500|1.29|LP|10||betteraves|
Fenouil|fl|pc|1|1.29|P|10|||9-12
Céleri-rave|fl|g|1000|1.69|LP|30|||9-3
Panais|fl|g|500|1.79|LBP|21||panais|10-3
Chou rouge|fl|g|1000|1.49|LBP|21|||9-3
Choux de Bruxelles|fl|g|500|1.99|LBP|10||chou de bruxelles|10-2
Coriandre|fl|pc|1|1.29|P|5|||
Myrtilles|fl|g|250|2.99|P|5|||7-9
Américain préparé|vi|g|250|3.49|LP|1||américain,filet américain|
Steak de bœuf|vi|g|300|6.49|LP|3||steak,entrecôte|
Filet de porc|vi|g|500|6.99|LP|3||filet mignon|
Boulettes|vi|g|500|4.99|LP|2||boulets|
Merguez|vi|pc|6|4.49|P|3|||
Scampis|vi|g|250|5.99|P|2|cr|crevettes,scampi|
Moules|vi|g|2000|7.99|P|2||moules de zélande|9-3
Saucisson|vi|g|200|3.29|L|30|||
Salami|vi|g|100|1.99|P|14|||
Filet de dinde|vi|g|500|6.29|LP|3||dinde|
Pâté de campagne|vi|g|200|1.99|LP|10||pâté|
Blanc de poulet tranché|vi|g|150|2.29|P|7||blanc de volaille|
Yaourt aux fruits|fr|pc|8|2.49|LP|21|la|yaourts|
Fromage blanc|fr|g|500|1.69|LBP|14|la|platte kaas|
Skyr|fr|g|450|2.29|P|21|la||
Gouda en tranches|fr|g|250|2.49|LP|21|la|fromage en tranches,gouda|
Brie|fr|g|200|2.49|P|14|la||
Fromage frais ail et fines herbes|fr|g|150|2.49|P|21|la|boursin|
Margarine|fr|g|500|1.99|S|60||minarine|
Crème liquide|fr|ml|250|1.29|LP|14|la|crème cuisine|
Crème dessert|fr|pc|4|1.49|P|21|la|dessert|
Pâte à pizza|fr|pc|1|1.49|P|21|gl||
Mascarpone|fr|g|250|2.49|P|14|la||
Pain gris|bo|pc|1|2.49|LBPC|4|gl|pain complet|
Pistolets|bo|pc|6|1.99|P|2|gl|pistolet|
Croissants|bo|pc|6|2.49|P|3|gl,la,oe|croissant|
Cramique|bo|pc|1|3.29|LP|4|gl,la,oe|craquelin|
Gaufres de Liège|bo|pc|6|2.49|L|21|gl,la,oe|gaufres|
Biscottes|bo|g|300|1.49|||gl||
Huile d'olive|ep|ml|1000|7.99|BSC|||huile|
Huile de tournesol|ep|ml|1000|2.49|S|||huile de friture|
Vinaigre|ep|ml|500|0.99|S|||vinaigre de vin|
Sel|ep|g|1000|0.59|S|||sel fin|
Poivre|ep|g|50|1.99|S|||poivre noir|
Sucre|ep|g|1000|1.29|LSC|||sucre blanc|
Farine|ep|g|1000|0.89|BS||gl||
Levure chimique|ep|g|50|0.99|S||||
Café moulu|ep|g|500|4.99|BC|||café|
Dosettes de café|ep|pc|36|4.49|C|||capsules café|
Thé|ep|pc|25|1.49|B|||sachets de thé|
Chocolat en poudre|ep|g|800|3.49|||la|cacao|
Céréales|ep|g|500|2.99|C||gl|corn flakes|
Muesli|ep|g|750|2.79|B||gl,fc|granola|
Flocons d'avoine|ep|g|500|1.19|B||gl|porridge|
Confiture|ep|g|450|1.99|LB|||confiture de fraises|
Pâte à tartiner|ep|g|400|2.99|C||la,fc|choco,nutella|
Miel|ep|g|250|3.99|LB||||
Beurre de cacahuète|ep|g|350|2.49|||fc|beurre d'arachide|
Chocolat noir|ep|g|200|1.79|L||la|chocolat|
Biscuits|ep|g|300|1.49|||gl,la,oe|petits beurre|
Spéculoos|ep|g|250|1.39|L||gl|speculoos|
Chips|ep|g|200|1.49||||chips nature|
Mayonnaise|ep|ml|500|1.99|LS||oe|mayo|
Ketchup|ep|ml|500|1.79|S||||
Sauce andalouse|ep|ml|300|1.69|L||oe|andalouse|
Quinoa|ep|g|400|2.99|B||||
Sardines (boîte)|ep|g|125|1.29|||po|sardines|
Compote de pommes|ep|g|700|1.49|L|||compote|
Noix de cajou|ep|g|200|2.99|||fc|cajou|
Amandes|ep|g|200|2.79|B||fc||
Raisins secs|ep|g|250|1.49|||||
Origan|ep|g|15|0.99|S||||
Paprika|ep|g|40|1.29|S|||paprika doux|
Muscade|ep|g|30|1.49|S||||
Cannelle|ep|g|30|1.29|S||||
Gnocchi|ep|g|500|1.69|||gl||
Eau plate|bs|ml|9000|1.89|C|||eau,bouteilles d'eau|
Eau pétillante|bs|ml|9000|2.49|L|||eau gazeuse|
Jus d'orange|bs|ml|1000|1.99|BC|||jus|
Jus de pomme|bs|ml|1000|1.49|LB||||
Cola|bs|ml|1500|1.99||||coca,coca-cola|
Bière blonde|bs|ml|6000|13.99|L||gl|bières,pils,jupiler|
Vin rouge|bs|ml|750|5.99|B||||
Vin blanc|bs|ml|750|5.49|B||||
Lait d'avoine|bs|ml|1000|1.99|B||gl|boisson à l'avoine|
Thé glacé|bs|ml|1500|1.69||||ice tea|
Frites surgelées|su|g|1000|1.99|LC|||frites|
Épinards hachés surgelés|su|g|1000|2.29|L||||
Légumes pour wok|su|g|750|2.49|||||
Pizza surgelée|su|pc|1|2.99|||gl,la|pizza|
Glace vanille|su|ml|1000|3.49|||la,oe|glace,crème glacée|
Poisson pané|su|g|300|2.99|||po,gl|fish sticks|
Haricots verts surgelés|su|g|1000|2.29|L||||
Framboises surgelées|su|g|300|2.99|||||
Croquettes de pommes de terre|su|g|600|1.99|L||gl|croquettes|
Papier toilette|dr|pc|12|5.99|C|||pq,rouleaux|
Essuie-tout|dr|pc|4|3.49|C|||sopalin,rouleaux essuie-tout|
Mouchoirs|dr|pc|10|1.99|C|||paquets de mouchoirs|
Liquide vaisselle|dr|ml|750|1.99|C|||produit vaisselle|
Pastilles lave-vaisselle|dr|pc|40|6.99|C|||tablettes lave-vaisselle|
Lessive liquide|dr|ml|2000|9.99|C|||lessive|
Adoucissant|dr|ml|1500|2.99|||||
Sacs poubelle|dr|pc|20|2.99|C|||sacs pmc,sac poubelle|
Éponges|dr|pc|6|1.49||||éponge|
Nettoyant multi-usage|dr|ml|1000|2.29||||nettoyant,produit nettoyant|
Eau de javel|dr|ml|1000|1.29||||javel|
Dentifrice|dr|ml|75|1.99|C||||
Brosses à dents|dr|pc|2|2.49||||brosse à dents|
Shampooing|dr|ml|300|2.99|C|||shampoing|
Gel douche|dr|ml|250|1.99|C|||savon douche|
Savon pour les mains|dr|ml|300|1.49|C|||savon|
Déodorant|dr|pc|1|2.99||||déo|
Rasoirs|dr|pc|4|4.99||||lames de rasoir|
Coton-tiges|dr|pc|200|1.29|||||
Papier aluminium|dr|pc|1|1.99||||alu|
Film alimentaire|dr|pc|1|1.49|||||
Papier cuisson|dr|pc|1|1.79|||||
Sacs congélation|dr|pc|30|1.99|||||
Couches|dr|pc|40|12.99||||langes|
Lingettes|dr|pc|64|1.99||||lingettes bébé|
Piles|dr|pc|4|4.99||||piles aa|
Ampoules|dr|pc|1|3.99||||ampoule led|
Litière|dr|g|10000|4.99||||litière chat|
Croquettes pour chat|dr|g|2000|7.99||||nourriture chat|
Chorizo|vi|g|200|3.29|P|30||chorizo doux|
Bacon|vi|g|150|2.29|P|10|||
Crevettes grises|vi|g|100|5.99|LP|3|cr|crevettes de la mer du nord|
Cuisse de lapin|vi|pc|1|3.49|LP|4||lapin|
Filet de truite|vi|g|250|5.49|LP|3|po|truite|
Escalope de veau|vi|g|300|6.99|LP|3||veau|
Rôti de porc|vi|g|800|7.99|LP|4||roti de porc|
Nouilles de riz|ep|g|250|1.99||365||vermicelles de riz|
Pâte de curry rouge|ep|g|100|2.49||365||curry rouge|
Garam masala|ep|g|40|2.29|S|365|||
Ras el hanout|ep|g|40|1.99|S|365|||
Harissa|ep|g|100|1.49||365|||
Tahini|ep|g|300|3.99||180||crème de sésame|
Huile de sésame|ep|ml|250|3.49||365|||
Graines de sésame|ep|g|100|1.49||365||sésame|
Cacahuètes|ep|g|200|1.79||180|fc|arachides|
Pruneaux|ep|g|250|2.99|B|180|||
Abricots secs|ep|g|250|2.99|B|180||abricots séchés|
Polenta|ep|g|500|1.99||365|||
Citron vert|fl|pc|1|0.39|P|21||lime|
Piment|fl|pc|1|0.29|P|10||piment rouge|
Chou chinois|fl|g|800|1.79|P|10||pak choï|
Germes de soja|fl|g|200|1.29|P|4||pousses de soja|
Cheddar|fr|g|200|2.79||30|la||
Pain hamburger|bo|pc|4|1.99||5|gl|pains burger|
Choucroute|fr|g|500|1.99|LP|14||choucroute crue|
Jarret de veau|vi|g|600|8.99|LP|3||osso buco|
Thym|fl|pc|1|1.29|LP|10||thym frais|
Feuille de laurier|ep|g|10|1.49|S|||laurier|
Clous de girofle|ep|g|30|1.99|S|||girofle,clou de girofle|
Bouillon de bœuf|ep|ml|6000|1.49|S||gl|bouillon de boeuf|
Bouillon de volaille|ep|ml|6000|1.49|S||gl|bouillon de poulet|
Fumet de poisson|ep|ml|1000|2.49|S||po||
Cerfeuil|fl|g|50|1.49|LP|5|||3-6,9-11
Cresson|fl|pc|1|1.79|LP|4||cresson de fontaine|
Asperges blanches|fl|g|1000|8.99|LP|4||asperges de malines|4-6
Pois cassés|ep|g|500|1.69|S|||pois cassés verts|
Chapelure|ep|g|400|1.29|S||gl|panure|
Sucre glace|ep|g|500|1.29|S|||sucre impalpable|
Sucre perlé|ep|g|250|1.99|LS|||sucre en grains|
Sucre vanillé|ep|g|80|0.99|S||||
Levure de boulanger|ep|g|35|0.99|S|||levure sèche,levure boulangère|
Fécule de maïs|ep|g|400|1.49|S|||maïzena,maizena|
Riz rond|ep|g|1000|1.79|S|||riz pour riz au lait,riz dessert|
Glace au café|su|ml|1000|3.99|||la,oe||
Filets de sole|vi|g|400|11.99|P|2|po|sole|
Fromage à raclette|fr|g|400|6.49|P|21|la|raclette|
Beaufort|fr|g|250|5.99|P|30|la||
Poulet entier|vi|g|1600|8.99|LBP|3||poulet fermier,poule|
Sauté de veau|vi|g|800|14.90|LP|3||veau en morceaux,blanquette de veau|
Magret de canard|vi|g|400|8.99|P|5||magret|
Câpres|ep|g|100|1.79|S|||capres|
Filets d'anchois|ep|g|50|2.19|S||po|anchois|
Graisse de canard|ep|g|350|3.49|S|||
Poudre d'amandes|ep|g|125|2.49|S||fc|amandes en poudre|
Tagliatelles|ep|g|500|1.69|B||gl,oe||
Cornichons|ep|g|350|1.59|S|||
Liqueur d'orange|bs|ml|350|12.99||||grand marnier,cointreau,triple sec|
Romarin|fl|pc|1|1.29|LP|10||romarin frais|
Amaretti|ep|g|200|2.49|S||fc,oe|amaretti morbidi|
Pecorino|fr|g|200|4.49|P|30|la|pecorino romano|
Cannelloni|ep|g|250|1.79|||gl|cannelloni secs|
Vodka|bs|ml|700|14.99|||||
Cacao en poudre|ep|g|250|2.99|S|||cacao non sucré|
Marsala|bs|ml|750|8.99|||||
Pignons de pin|ep|g|100|3.49|S||fc|pignons|
Pêches|fl|g|1000|3.49|LBP|5||pêche|6-9
Feuilles de vigne|ep|g|250|3.49|S|||feuilles de vigne en saumure|
Pâte filo|fr|g|250|2.49|P|30|gl|filo,phyllo,pâte brick|
Pâtes orzo|ep|g|500|1.79|||gl|orzo,kritharaki,langues d'oiseau|
Vermicelles|ep|g|250|1.29|||gl|fideos,vermicelle|
Safran|ep|g|1|3.99|S|||pistils de safran|
Yaourt grec|fr|g|500|2.49|P|21|la|yaourt à la grecque|
Aneth|fl|pc|1|1.29|P|7|||
Sumac|ep|g|50|2.49|S||||
Fèves sèches|ep|g|500|2.29|S|||fèves cassées|
Eau de fleur d'oranger|ep|ml|250|2.29|S||||
Citrons confits|ep|g|200|2.99|S|||citron confit|
Olives vertes|ep|g|200|1.79|S||||
Dattes|ep|g|250|2.49|S|||dattes medjool,dattes deglet nour|
Pâte d'amandes|ep|g|250|2.99|S||fc|massepain|
Cardamome|ep|g|30|2.99|S|||cardamome verte|
Zaatar|ep|g|50|2.49|S||||
Frik|ep|g|500|2.99|S||gl|blé vert concassé,freekeh|
Edamame|su|g|400|2.99|||so|fèves de soja|
Pak choï|fl|g|500|2.49|P|5||bok choy,pak choi|
Pâte de curry verte|ep|g|100|2.49|S|||curry vert|
Pâte de curry massaman|ep|g|100|2.49|S|||curry massaman|
Citronnelle|fl|g|100|1.99|P|14||lemongrass|
Nuoc-mâm|ep|ml|200|2.29|S||po|sauce de poisson,sauce poisson|
Sauce huître|ep|ml|250|2.49|S||po,gl|sauce aux huîtres|
Mirin|ep|ml|300|3.49|S||||
Vinaigre de riz|ep|ml|250|2.29|S||||
Pâte miso|ep|g|300|3.99|S||so|miso|
Dashi en poudre|ep|g|50|3.49|S||po|dashi|
Feuilles de wonton|fr|g|250|2.49|P|30|gl|pâte à wonton,feuilles à raviolis chinois|
Vin de riz chinois (Shaoxing)|ep|ml|500|2.99|S|365||vin de shaoxing|
Poivre du Sichuan|ep|g|30|2.99|S||||
Doubanjiang|ep|g|200|2.99|S||so,gl|pâte de piment fermentée|
Gochujang|ep|g|200|3.49|S||so,gl|pâte de piment coréenne|
Kimchi|fr|g|400|3.99|P|60||kimchi de chou|
Farine de riz gluant|ep|g|400|2.49|S|||mochiko|
Perles du Japon|ep|g|250|1.79|S|||tapioca,perles de tapioca|
Pâte de haricots rouges|ep|g|500|3.49|S|||anko,haricots azuki sucrés|
Curcuma|ep|g|40|1.79|S||||
Paneer|fr|g|200|2.99|P|21|la||
Farine de pois chiches|ep|g|500|2.29|S|||besan|
Graines de moutarde|ep|g|50|1.99|S||||
Mangue|fl|pc|1|1.49|P|7||mangues|
Ghee|ep|g|250|5.49|S||la|beurre clarifié|
Pistaches|ep|g|125|3.49|S||fc|pistaches décortiquées|
Riz aplati (poha)|ep|g|500|2.49|S|||poha|
Farine complète|ep|g|1000|1.49|S||gl|atta,farine de blé complet|
Fécule de manioc|ep|g|500|2.49|S|||tapioca en farine,polvilho|
Bananes plantains|fl|pc|1|0.99|P|7||plantain,banane plantain|
Haricots noirs (boîte)|ep|g|400|1.29|S|||haricots noirs,frijoles|
Farine de maïs précuite|ep|g|1000|3.49|S|||harina pan,masarepa|
Lait concentré sucré|ep|g|397|1.99|S||la||
Lait évaporé|ep|ml|410|1.79|S||la|lait concentré non sucré|
Pâte d'achiote|ep|g|100|3.99|S|||achiote,rocou|
Bavette de bœuf|vi|g|500|9.99|LP|3||bavette,flanchet|
Provolone|fr|g|250|3.99|P|30|la||
Dulce de leche|ep|g|400|3.49|S||la|confiture de lait|
Noix de coco râpée|ep|g|200|1.99|S|||coco râpée|
Vermicelles en chocolat|ep|g|200|1.99|S||la|granulés de chocolat|
Épis de maïs|fl|pc|2|1.99|LP|5||maïs en épi|7-9
Noix de pécan|ep|g|125|3.49|S||fc|pécan|
Fromage frais nature|fr|g|300|2.49|P|21|la|cream cheese,philadelphia|
Biscuits digestive|ep|g|400|1.79|S||gl,la|digestive,biscuits graham|
Sirop d'érable|ep|ml|250|5.99|S|||sirop d'erable|
Sauce barbecue|ep|ml|500|2.49|S|||sauce bbq|
Babeurre|fr|ml|1000|1.19|LP|10|la|karnemelk,lait battu,buttermilk|
Fromage bleu|fr|g|150|2.99|P|21|la|bleu,roquefort,gorgonzola|
Salade iceberg|fl|pc|1|1.29|P|7||iceberg|
Sauce piquante|ep|ml|60|2.49|S|||tabasco|
Raifort|ep|g|150|2.49|S|||raifort râpé|
Muffins anglais|bo|pc|6|1.99|P|7|gl|english muffins|
Ailes de poulet|vi|g|1000|5.99|LP|3||chicken wings|
Chou blanc|fl|g|1000|1.49|LBP|21||chou cabus blanc|
Travers de porc|vi|g|1000|8.99|LP|3||spare ribs,ribs|
Rhum|bs|ml|700|14.99||||rhum brun,rhum ambré|
Châtaignes|ep|g|400|4.99|S|||marrons cuits,châtaignes cuites|10-1
Rôti de bœuf|vi|g|1000|19.90|LP|3||rosbif,rôti de boeuf|
Joues de porc|vi|g|1000|9.99|LP|3||joue de porc|
Noisettes|ep|g|200|2.99|S||fc|noisettes décortiquées|
Farine de seigle|ep|g|1000|1.99|S||gl||
Cuisses de canard confites|vi|pc|2|7.99|P|90||confit de canard|
Gigot d'agneau|vi|g|2000|29.90|P|4||gigot|
Cidre|bs|ml|750|2.99||||cidre brut|
Pâte de praliné|ep|g|200|4.49|S||fc|praliné|
Biscuits à la cuillère|ep|g|200|1.99|S||gl,oe|boudoirs|
Graines de fenouil|ep|g|40|1.99|S||||
Tortellini|fr|g|250|2.79|P|30|gl,oe,la|tortellini frais|
Vinaigre balsamique|ep|ml|250|2.99|S|||balsamique,aceto balsamico|
Bar|vi|g|500|11.99|P|2|po|loup de mer,bar entier|
Pimientos de Padrón|fl|g|200|2.99|P|7||piments de padron|
Biscuits Maria|ep|g|200|1.29|S||gl|galletas maria|
Thon frais|vi|g|400|12.99|P|2|po|thon rouge,thon albacore|
Mélasse de grenade|ep|ml|250|3.99|S|||sirop de grenade,dibs rumman|
Agar-agar|ep|g|10|2.49|S||||
Feuilles de nori|ep|g|30|2.99|S|||nori,algues nori|
Haddock fumé|vi|g|300|6.99|P|5|po|églefin fumé|
Fruits de la passion|fl|g|250|0.79|P|10||maracuja,passion|
Bagels|bo|g|360|2.49|P|5|gl|bagel|
Haricots à la sauce tomate (boîte)|ep|g|415|0.99|S|||baked beans en boîte|
`;
