/* ============================================================================
   NEXUS LAUNCHER — NGON NGU GIAO DIEN (5 thu tieng)
   JavaScript thuan, KHONG di qua Babel, nap TRUOC moi file giao dien.

   CACH LAM: khoa cua tu dien chinh la cau tieng Viet goc. Nho vay khi dang o
   tieng Viet thi ham TX() tra ve dung cau da viet trong ma nguon, khong can
   tra cuu gi ca; va neu mot cau nao do chua kip dich thi no van hien ra binh
   thuong bang tieng Viet chu khong bao gio de trong hay hien ra ma khoa la.

   KHONG BAO GIO DICH: ten tro choi, ten nhan vat, ten rieng, ten thuong hieu
   ("Nexus Launcher", "Steam", "Discord", "Cánh Cụt Team", "Game Thuần Việt",
   "Fluenty UI", "NexusT"). Nhung chuoi do khong co mat trong tu dien nay.
   ========================================================================== */
(function () {
  'use strict';

  /* --------------------------------------------------------------------------
     DANH SACH NGON NGU
     code  : ma noi bo, cung la khoa luu trong may
     label : ten tu goi cua chinh ngon ngu do (khong bao gio dich)
     short : hai chu cai hien tren nut chon
     steam : ten ngon ngu Steam dung trong tham so ?l=
     html  : gia tri cho thuoc tinh lang cua the <html>
     font  : bo chu dung cho ngon ngu do
     ------------------------------------------------------------------------ */
  var LANGS = [
    { code: 'vi', label: 'Tiếng Việt', short: 'VI', steam: 'vietnamese', html: 'vi', flag: '🇻🇳' },
    { code: 'en', label: 'English',    short: 'EN', steam: 'english',    html: 'en', flag: '🇬🇧' },
    { code: 'ja', label: '日本語',      short: 'JA', steam: 'japanese',   html: 'ja', flag: '🇯🇵' },
    { code: 'es', label: 'Español',    short: 'ES', steam: 'spanish',    html: 'es', flag: '🇪🇸' },
    { code: 'fr', label: 'Français',   short: 'FR', steam: 'french',     html: 'fr', flag: '🇫🇷' }
  ];

  var IDX = { en: 0, ja: 1, es: 2, fr: 3 };
  var DICT = {};

  /* Mot dong = mot cau. Thu tu: tieng Viet, English, 日本語, Español, Français */
  function D(vi, en, ja, es, fr) { DICT[vi] = [en, ja, es, fr]; }

  /* ==========================================================================
     1. KHUNG UNG DUNG — rail trai, thanh tren, trang thai Steam
     ========================================================================== */
  D('Trang chủ', 'Home', 'ホーム', 'Inicio', 'Accueil');
  D('Thư viện', 'Library', 'ライブラリ', 'Biblioteca', 'Bibliothèque');
  D('Tích hợp', 'Integrations', '連携機能', 'Integraciones', 'Intégrations');
  D('Chi tiết', 'Details', '詳細', 'Detalles', 'Détails');
  D('Điều hướng', 'Navigation', 'ナビゲーション', 'Navegación', 'Navigation');
  D('Lối tắt', 'Shortcuts', 'ショートカット', 'Accesos directos', 'Raccourcis');
  D('Tra cứu AppID', 'AppID lookup', 'AppID を検索', 'Buscar AppID', 'Rechercher un AppID');
  D('Cộng đồng Discord', 'Discord community', 'Discord コミュニティ', 'Comunidad de Discord', 'Communauté Discord');
  D('Trò chơi nổi bật và mới cập nhật', 'Featured and recently updated games', '注目のゲームと新着アップデート', 'Juegos destacados y recién actualizados', 'Jeux à la une et récemment mis à jour');
  D('Toàn bộ trò chơi có trong Nexus', 'Every game available in Nexus', 'Nexus にあるすべてのゲーム', 'Todos los juegos disponibles en Nexus', 'Tous les jeux disponibles dans Nexus');
  D('Dịch vụ chạy trực tiếp trên máy bạn', 'Services that run right on your PC', 'あなたの PC で直接動くサービス', 'Servicios que se ejecutan en tu PC', 'Des services qui tournent directement sur votre PC');
  D('Thông tin, hình ảnh và cài đặt', 'Info, media and installation', '情報・メディア・インストール', 'Información, imágenes e instalación', 'Infos, images et installation');
  D('Đang kiểm tra Steam', 'Checking Steam', 'Steam を確認中', 'Comprobando Steam', 'Vérification de Steam');
  D('Steam đã sẵn sàng', 'Steam is ready', 'Steam の準備完了', 'Steam está listo', 'Steam est prêt');
  D('Chưa cài đặt Steam', 'Steam is not installed', 'Steam が未インストール', 'Steam no está instalado', "Steam n'est pas installé");
  D('Chế độ xem trước', 'Preview mode', 'プレビューモード', 'Modo de vista previa', 'Mode aperçu');
  D('Bấm để kiểm tra lại', 'Click to check again', 'クリックで再確認', 'Haz clic para volver a comprobar', 'Cliquez pour revérifier');
  D('Ngôn ngữ giao diện', 'Interface language', '表示言語', 'Idioma de la interfaz', "Langue de l'interface");
  D('Chọn ngôn ngữ', 'Choose a language', '言語を選択', 'Elegir idioma', 'Choisir une langue');
  D('Toàn bộ giao diện sẽ đổi theo', 'The whole interface follows your choice', '選択に合わせて画面全体が切り替わります', 'Toda la interfaz cambia contigo', "Toute l'interface suit votre choix");

  /* ==========================================================================
     2. CHUNG — nut bam, thao tac lap lai o nhieu noi
     ========================================================================== */
  D('Đóng', 'Close', '閉じる', 'Cerrar', 'Fermer');
  D('Hủy', 'Cancel', 'キャンセル', 'Cancelar', 'Annuler');
  D('Xóa', 'Clear', 'クリア', 'Borrar', 'Effacer');
  D('Quay lại', 'Back', '戻る', 'Atrás', 'Retour');
  D('Quay lại (Esc)', 'Back (Esc)', '戻る (Esc)', 'Atrás (Esc)', 'Retour (Échap)');
  D('Trước', 'Previous', '前へ', 'Anterior', 'Précédent');
  D('Lùi lại', 'Scroll left', '左へスクロール', 'Desplazar a la izquierda', 'Défiler à gauche');
  D('Tiến tới', 'Scroll right', '右へスクロール', 'Desplazar a la derecha', 'Défiler à droite');
  D('Phóng to', 'Zoom in', '拡大', 'Ampliar', 'Agrandir');
  D('Đường dẫn', 'Breadcrumb', 'パンくずリスト', 'Ruta de navegación', "Fil d'Ariane");
  D('Xem mục {n}', 'Go to item {n}', '{n} 番目を表示', 'Ir al elemento {n}', "Aller à l'élément {n}");
  D('Duyệt', 'Browse', '参照', 'Examinar', 'Parcourir');
  D('Trò chơi', 'Games', 'ゲーム', 'Juegos', 'Jeux');
  D('{n} trò chơi', '{n} games', '{n} 本のゲーム', '{n} juegos', '{n} jeux');
  D('Chức năng chưa khả dụng trong phiên bản này.', 'This feature is not available in this version.', 'この機能はこのバージョンでは利用できません。', 'Esta función no está disponible en esta versión.', "Cette fonction n'est pas disponible dans cette version.");
  D('Không nhận được phản hồi.', 'No response received.', '応答がありませんでした。', 'No se recibió respuesta.', 'Aucune réponse reçue.');

  /* Ngay thang */
  D('Chủ nhật', 'Sunday', '日曜日', 'Domingo', 'Dimanche');
  D('Thứ hai', 'Monday', '月曜日', 'Lunes', 'Lundi');
  D('Thứ ba', 'Tuesday', '火曜日', 'Martes', 'Mardi');
  D('Thứ tư', 'Wednesday', '水曜日', 'Miércoles', 'Mercredi');
  D('Thứ năm', 'Thursday', '木曜日', 'Jueves', 'Jeudi');
  D('Thứ sáu', 'Friday', '金曜日', 'Viernes', 'Vendredi');
  D('Thứ bảy', 'Saturday', '土曜日', 'Sábado', 'Samedi');
  D('Tháng {m}/{y}', '{m}/{y}', '{y}年{m}月', '{m}/{y}', '{m}/{y}');

  /* ==========================================================================
     3. TRANG CHU
     ========================================================================== */
  D('Nổi bật hôm nay', 'Featured today', '本日の注目', 'Destacado de hoy', "À la une aujourd'hui");
  D('Việt hoá', 'Vietnamese', 'ベトナム語版', 'En vietnamita', 'En vietnamien');
  D('Việt hóa', 'Vietnamese', 'ベトナム語版', 'En vietnamita', 'En vietnamien');
  D('VIỆT HÓA', 'VIETNAMESE', 'ベトナム語版', 'EN VIETNAMITA', 'EN VIETNAMIEN');
  D('Có Việt hóa', 'Vietnamese available', 'ベトナム語版あり', 'Con vietnamita', 'Version vietnamienne');
  D('Thư viện Nexus tổng hợp trò chơi bản quyền — truy cập nhanh, cài đặt gọn, không quảng cáo.', 'The Nexus library gathers licensed games — quick access, tidy installs, no ads.', 'Nexus ライブラリは正規ゲームを一か所に。すばやくアクセス、すっきりインストール、広告なし。', 'La biblioteca Nexus reúne juegos con licencia: acceso rápido, instalación limpia y sin anuncios.', 'La bibliothèque Nexus rassemble des jeux sous licence — accès rapide, installation soignée, sans publicité.');
  D('Xem chi tiết', 'View details', '詳細を見る', 'Ver detalles', 'Voir les détails');
  D('Toàn bộ thư viện', 'Full library', 'ライブラリ全体', 'Biblioteca completa', 'Toute la bibliothèque');
  D('Xem tất cả', 'See all', 'すべて見る', 'Ver todo', 'Tout voir');
  D('Nguồn riêng', 'Direct source', '独自配信', 'Fuente propia', 'Source dédiée');
  D('NGUỒN RIÊNG', 'DIRECT SOURCE', '独自配信', 'FUENTE PROPIA', 'SOURCE DÉDIÉE');
  D('Sắp ra mắt', 'Coming soon', '近日公開', 'Próximamente', 'Bientôt disponible');
  D('Đang thịnh hành', 'Trending now', '人気急上昇', 'En tendencia', 'Tendances du moment');
  D('Nhiều lượt đánh giá nhất trên Steam', 'Most reviewed on Steam', 'Steam で最もレビューが多い', 'Los más reseñados en Steam', 'Les plus commentés sur Steam');
  D('Mới cập nhật', 'Recently added', '新着', 'Recién añadidos', 'Récemment ajoutés');
  D('Vừa được thêm vào thư viện', 'Just added to the library', 'ライブラリに追加されたばかり', 'Recién añadidos a la biblioteca', 'Tout juste ajoutés à la bibliothèque');
  D('Đếm ngược tới ngày phát hành', 'Counting down to release', '発売日までカウントダウン', 'Cuenta atrás para el lanzamiento', 'Compte à rebours avant la sortie');
  D('Đánh giá cao nhất', 'Top rated', '高評価', 'Mejor valorados', 'Les mieux notés');
  D('Người chơi Steam chấm điểm tốt nhất', 'Highest scored by Steam players', 'Steam ユーザーの評価が最も高い', 'Los mejor puntuados por los jugadores de Steam', 'Les mieux notés par les joueurs Steam');
  D('Bản dịch tiếng Việt sẵn sàng', 'Vietnamese translation ready', 'ベトナム語訳が利用可能', 'Traducción al vietnamita lista', 'Traduction vietnamienne disponible');
  D('Duyệt theo thể loại', 'Browse by genre', 'ジャンルで探す', 'Explorar por género', 'Parcourir par genre');
  D('Chọn nhanh phong cách bạn thích', 'Pick the style you like', '好みのスタイルをすぐ選べます', 'Elige rápido el estilo que te gusta', 'Choisissez vite le style qui vous plaît');
  D('CỘNG ĐỒNG NEXUS', 'NEXUS COMMUNITY', 'NEXUS コミュニティ', 'COMUNIDAD NEXUS', 'COMMUNAUTÉ NEXUS');
  D('Tham gia Discord để nhận game mới, bản vá và hỗ trợ trực tiếp', 'Join Discord for new games, patches and direct support', 'Discord に参加して新作・パッチ・直接サポートを受け取ろう', 'Únete a Discord para recibir juegos nuevos, parches y soporte directo', 'Rejoignez Discord pour les nouveaux jeux, les correctifs et une aide directe');

  /* ==========================================================================
     4. THU VIEN — bo loc, sap xep, tim kiem
     ========================================================================== */
  D('Tất cả', 'All', 'すべて', 'Todos', 'Tout');
  D('Cần kích hoạt', 'Needs activation', 'キー認証が必要', 'Requiere activación', 'Activation requise');
  D('Chơi mạng', 'Online play', 'オンライン対応', 'Juego en línea', 'Jeu en ligne');
  D('Tên A → Z', 'Name A → Z', '名前 A → Z', 'Nombre A → Z', 'Nom A → Z');
  D('Tên Z → A', 'Name Z → A', '名前 Z → A', 'Nombre Z → A', 'Nom Z → A');
  D('Điểm đánh giá cao', 'Highest rated', '評価が高い順', 'Mejor valorados', 'Note la plus élevée');
  D('Nhiều lượt đánh giá', 'Most reviews', 'レビューが多い順', 'Más reseñas', "Plus d'avis");
  D('Mới thêm gần đây', 'Recently added', '追加が新しい順', 'Añadidos recientemente', 'Ajoutés récemment');
  D('Tìm trò chơi, thẻ, App ID…', 'Search games, tags, App ID…', 'ゲーム・タグ・App ID を検索…', 'Buscar juegos, etiquetas, App ID…', 'Rechercher un jeu, un tag, un App ID…');
  D('Bỏ lọc thể loại', 'Clear genre filter', 'ジャンル絞り込みを解除', 'Quitar el filtro de género', 'Retirer le filtre de genre');
  D('Kiểu hiển thị', 'View mode', '表示モード', 'Modo de vista', "Mode d'affichage");
  D('Hiển thị dạng lưới', 'Grid view', 'グリッド表示', 'Vista en cuadrícula', 'Vue en grille');
  D('Hiển thị dạng danh sách', 'List view', 'リスト表示', 'Vista en lista', 'Vue en liste');
  D('Không tìm thấy trò chơi nào', 'No games found', 'ゲームが見つかりません', 'No se encontró ningún juego', 'Aucun jeu trouvé');
  D('Thử đổi từ khóa hoặc bỏ bớt bộ lọc đang bật.', 'Try another keyword or turn off some filters.', 'キーワードを変えるか、フィルターを減らしてください。', 'Prueba con otra palabra clave o quita algunos filtros.', "Essayez un autre mot-clé ou retirez quelques filtres.");
  D('Đặt lại bộ lọc', 'Reset filters', 'フィルターをリセット', 'Restablecer filtros', 'Réinitialiser les filtres');

  /* Man hinh qua hep */
  D('Cửa sổ đang quá hẹp', 'The window is too narrow', 'ウィンドウが狭すぎます', 'La ventana es demasiado estrecha', 'La fenêtre est trop étroite');
  D('Nexus Launcher cần chiều ngang tối thiểu 820px để hiển thị đầy đủ thanh điều hướng, kệ trò chơi và bảng thông tin. Hãy phóng to cửa sổ hoặc giảm mức thu phóng bằng', 'Nexus Launcher needs at least 820px of width to show the navigation bar, the game shelves and the info panel in full. Maximise the window or zoom out with', 'Nexus Launcher はナビゲーションバー、ゲーム棚、情報パネルをすべて表示するために横幅 820px 以上を必要とします。ウィンドウを最大化するか、次のキーで縮小してください:', 'Nexus Launcher necesita al menos 820px de ancho para mostrar por completo la barra de navegación, las estanterías de juegos y el panel de información. Maximiza la ventana o reduce el zoom con', "Nexus Launcher a besoin d'au moins 820px de largeur pour afficher entièrement la barre de navigation, les étagères de jeux et le panneau d'informations. Agrandissez la fenêtre ou dézoomez avec");
  D('Ctrl và dấu trừ', 'Ctrl and minus', 'Ctrl とマイナスキー', 'Ctrl y el signo menos', 'Ctrl et le signe moins');
  D('(hiện tại: {w}px)', '(currently: {w}px)', '(現在: {w}px)', '(actualmente: {w}px)', '(actuellement : {w}px)');
  D('Cần hỗ trợ? Vào Discord', 'Need help? Join Discord', 'サポートが必要ですか？Discord へ', '¿Necesitas ayuda? Entra en Discord', "Besoin d'aide ? Rejoignez Discord");

  /* ==========================================================================
     5. THE GAME · THE SAP RA MAT
     ========================================================================== */
  D('KÍCH HOẠT', 'ACTIVATION', 'キー認証', 'ACTIVACIÓN', 'ACTIVATION');
  D('MIỄN PHÍ', 'FREE', '無料', 'GRATIS', 'GRATUIT');
  D('đánh giá', 'reviews', '件のレビュー', 'reseñas', 'avis');
  D('lượt đánh giá', 'reviews', '件のレビュー', 'reseñas', 'avis');
  D('lượt đánh giá trên Steam', 'reviews on Steam', 'Steam のレビュー数', 'reseñas en Steam', 'avis sur Steam');
  D('Đang cập nhật', 'Updating', '更新中', 'Actualizando', 'Mise à jour');
  D('ĐÃ RA MẮT', 'RELEASED', '発売済み', 'LANZADO', 'SORTI');
  D('SẮP TỚI', 'VERY SOON', 'まもなく', 'MUY PRONTO', 'TRÈS BIENTÔT');
  D('SẮP RA MẮT', 'COMING SOON', '近日公開', 'PRÓXIMAMENTE', 'BIENTÔT');
  D('ĐÃ PHÁT HÀNH', 'NOW AVAILABLE', '配信中', 'YA DISPONIBLE', 'DISPONIBLE');
  D('Steam đã dời lịch {n} ngày', 'Steam moved the date by {n} days', 'Steam が発売日を {n} 日ずらしました', 'Steam movió la fecha {n} días', 'Steam a décalé la date de {n} jours');
  D('DỜI LẠI', 'DELAYED', '延期', 'RETRASADO', 'REPORTÉ');
  D('SỚM HƠN', 'EARLIER', '前倒し', 'ADELANTADO', 'AVANCÉ');
  D('Múi giờ Việt Nam (UTC+7)', 'Vietnam time (UTC+7)', 'ベトナム時間 (UTC+7)', 'Hora de Vietnam (UTC+7)', 'Heure du Vietnam (UTC+7)');
  D('theo Steam', 'per Steam', 'Steam 基準', 'según Steam', 'selon Steam');
  D('NGÀY', 'DAYS', '日', 'DÍAS', 'JOURS');
  D('GIỜ', 'HRS', '時間', 'HORAS', 'HEURES');
  D('PHÚT', 'MIN', '分', 'MIN', 'MIN');
  D('GIÂY', 'SEC', '秒', 'SEG', 'SEC');
  D('Chưa Phát Hành', 'Not released yet', '未発売', 'Aún sin lanzar', 'Pas encore sorti');
  D('Sắp Ra Mắt', 'Coming soon', '近日公開', 'Próximamente', 'Bientôt disponible');

  /* ==========================================================================
     6. NHAN DANH GIA CUA STEAM
     ========================================================================== */
  D('CỰC KỲ TÍCH CỰC', 'OVERWHELMINGLY POSITIVE', '圧倒的に好評', 'ABRUMADORAMENTE POSITIVAS', 'EXTRÊMEMENT POSITIVES');
  D('RẤT TÍCH CỰC', 'VERY POSITIVE', '非常に好評', 'MUY POSITIVAS', 'TRÈS POSITIVES');
  D('HẦU HẾT TÍCH CỰC', 'MOSTLY POSITIVE', 'やや好評', 'MAYORMENTE POSITIVAS', 'PLUTÔT POSITIVES');
  D('ĐA DẠNG', 'MIXED', '賛否両論', 'VARIADAS', 'MOYENNES');
  D('TRÁI CHIỀU', 'MIXED', '賛否両論', 'VARIADAS', 'MOYENNES');
  D('HẦU HẾT TIÊU CỰC', 'MOSTLY NEGATIVE', 'やや不評', 'MAYORMENTE NEGATIVAS', 'PLUTÔT NÉGATIVES');
  D('TIÊU CỰC', 'NEGATIVE', '不評', 'NEGATIVAS', 'NÉGATIVES');
  D('TÍCH CỰC', 'POSITIVE', '好評', 'POSITIVAS', 'POSITIVES');
  D('CHƯA CÓ ĐÁNH GIÁ', 'NO REVIEWS YET', 'レビューなし', 'SIN RESEÑAS', 'AUCUN AVIS');
  D('Chưa có đánh giá', 'No reviews yet', 'レビューはまだありません', 'Sin reseñas todavía', 'Pas encore d’avis');
  D('Chưa có dữ liệu', 'No data yet', 'データがありません', 'Sin datos', 'Aucune donnée');

  /* ==========================================================================
     7. THE LOAI — dung lam nhan hien thi; khoa loc van la chu tieng Viet goc
     ========================================================================== */
  D('HÀNH ĐỘNG', 'ACTION', 'アクション', 'ACCIÓN', 'ACTION');
  D('PHIÊU LƯU', 'ADVENTURE', 'アドベンチャー', 'AVENTURA', 'AVENTURE');
  D('NHẬP VAI', 'RPG', 'RPG', 'ROL', 'JEU DE RÔLE');
  D('NHẬP VAI (RPG)', 'RPG', 'RPG', 'ROL (RPG)', 'JEU DE RÔLE (RPG)');
  D('MÔ PHỎNG', 'SIMULATION', 'シミュレーション', 'SIMULACIÓN', 'SIMULATION');
  D('HỢP TÁC', 'CO-OP', '協力プレイ', 'COOPERATIVO', 'COOPÉRATION');
  D('CHIẾN LƯỢC', 'STRATEGY', 'ストラテジー', 'ESTRATEGIA', 'STRATÉGIE');
  D('CHIẾN THUẬT', 'TACTICS', 'タクティクス', 'TÁCTICAS', 'TACTIQUE');
  D('BẮN SÚNG', 'SHOOTER', 'シューティング', 'DISPAROS', 'JEU DE TIR');
  D('KINH DỊ', 'HORROR', 'ホラー', 'TERROR', 'HORREUR');
  D('GIẢI ĐỐ', 'PUZZLE', 'パズル', 'PUZLES', 'RÉFLEXION');
  D('GIẢI TRÍ', 'CASUAL', 'カジュアル', 'ENTRETENIMIENTO', 'DIVERTISSEMENT');
  D('THỂ THAO', 'SPORTS', 'スポーツ', 'DEPORTES', 'SPORT');
  D('ĐUA XE', 'RACING', 'レース', 'CARRERAS', 'COURSE');
  D('XÂY DỰNG', 'BUILDING', '建築', 'CONSTRUCCIÓN', 'CONSTRUCTION');
  D('QUẢN LÝ', 'MANAGEMENT', '経営', 'GESTIÓN', 'GESTION');
  D('SÁNG TẠO', 'CREATIVE', 'クリエイティブ', 'CREATIVIDAD', 'CRÉATIF');
  D('THƯ GIÃN', 'RELAXING', 'リラックス', 'RELAJANTE', 'DÉTENTE');
  D('HÀI', 'COMEDY', 'コメディ', 'COMEDIA', 'COMÉDIE');
  D('HÀI HƯỚC', 'FUNNY', 'コメディ', 'HUMOR', 'HUMOUR');
  D('CHƠI ĐƠN', 'SINGLE-PLAYER', 'シングルプレイ', 'UN JUGADOR', 'SOLO');
  D('CHƠI NHIỀU NGƯỜI', 'MULTIPLAYER', 'マルチプレイ', 'MULTIJUGADOR', 'MULTIJOUEUR');
  D('CHƠI MIỄN PHÍ', 'FREE TO PLAY', '基本無料', 'FREE TO PLAY', 'FREE-TO-PLAY');
  D('CHIA MÀN HÌNH', 'SPLIT SCREEN', '画面分割', 'PANTALLA DIVIDIDA', 'ÉCRAN PARTAGÉ');
  D('HỢP TÁC CHIA MÀN HÌNH', 'SPLIT-SCREEN CO-OP', '画面分割の協力プレイ', 'COOP A PANTALLA DIVIDIDA', 'COOP EN ÉCRAN PARTAGÉ');
  D('HỢP TÁC TRỰC TUYẾN', 'ONLINE CO-OP', 'オンライン協力プレイ', 'COOP EN LÍNEA', 'COOP EN LIGNE');
  D('PVP', 'PVP', '対人戦', 'JCJ', 'JCJ');
  D('PVP CHIA MÀN HÌNH', 'SPLIT-SCREEN PVP', '画面分割の対人戦', 'JCJ A PANTALLA DIVIDIDA', 'JCJ EN ÉCRAN PARTAGÉ');
  D('PVP LAN', 'LAN PVP', 'LAN 対人戦', 'JCJ POR LAN', 'JCJ EN LAN');
  D('PVP TRỰC TUYẾN', 'ONLINE PVP', 'オンライン対人戦', 'JCJ EN LÍNEA', 'JCJ EN LIGNE');
  D('PHỐI HỢP', 'TEAMWORK', 'チームプレイ', 'TRABAJO EN EQUIPO', "TRAVAIL D'ÉQUIPE");
  D('CHIA SẺ GIA ĐÌNH', 'FAMILY SHARING', 'ファミリーシェア', 'FAMILY SHARING', 'PARTAGE FAMILIAL');
  D('CLOUD SAVE', 'CLOUD SAVE', 'クラウドセーブ', 'GUARDADO EN LA NUBE', 'SAUVEGARDE CLOUD');
  D('THÀNH TỰU', 'ACHIEVEMENTS', '実績', 'LOGROS', 'SUCCÈS');
  D('HỖ TRỢ TAY CẦM', 'CONTROLLER SUPPORT', 'コントローラー対応', 'COMPATIBLE CON MANDO', 'COMPATIBLE MANETTE');
  D('HỖ TRỢ VR', 'VR SUPPORT', 'VR 対応', 'COMPATIBLE CON RV', 'COMPATIBLE VR');
  D('ĐA NỀN TẢNG', 'CROSS-PLATFORM', 'クロスプラットフォーム', 'MULTIPLATAFORMA', 'MULTIPLATEFORME');
  D('ĐỘC LẬP', 'INDIE', 'インディー', 'INDIE', 'INDÉPENDANT');
  D('INDIE', 'INDIE', 'インディー', 'INDIE', 'INDÉPENDANT');
  D('TRUY CẬP SỚM', 'EARLY ACCESS', '早期アクセス', 'ACCESO ANTICIPADO', 'ACCÈS ANTICIPÉ');
  D('EARLY ACCESS', 'EARLY ACCESS', '早期アクセス', 'ACCESO ANTICIPADO', 'ACCÈS ANTICIPÉ');
  D('ANIME', 'ANIME', 'アニメ', 'ANIME', 'ANIMÉ');
  D('GÁCHA', 'GACHA', 'ガチャ', 'GACHA', 'GACHA');
  D('MMO', 'MMO', 'MMO', 'MMO', 'MMO');
  D('MOD', 'MODS', 'MOD 対応', 'MODS', 'MODS');
  D('METROIDVANIA', 'METROIDVANIA', 'メトロイドヴァニア', 'METROIDVANIA', 'METROIDVANIA');
  D('ROGUELITE', 'ROGUELITE', 'ローグライト', 'ROGUELITE', 'ROGUELITE');
  D('SANDBOX', 'SANDBOX', 'サンドボックス', 'SANDBOX', 'BAC À SABLE');
  D('ZOMBIE', 'ZOMBIES', 'ゾンビ', 'ZOMBIS', 'ZOMBIES');
  D('THẦM KHÍ', 'STEALTH', 'ステルス', 'SIGILO', 'INFILTRATION');
  D('VAI TƯỞNG', 'FANTASY', 'ファンタジー', 'FANTASÍA', 'FANTASY');
  D('THẺ ĐỔI', 'TRADING CARDS', 'トレーディングカード', 'CROMOS', 'CARTES À COLLECTIONNER');
  D('TIỆN ÍCH', 'UTILITY', 'ユーティリティ', 'UTILIDADES', 'UTILITAIRE');
  D('PHÁT TRIỂN TRÒ CHƠI', 'GAME DEVELOPMENT', 'ゲーム開発', 'DESARROLLO DE JUEGOS', 'CRÉATION DE JEUX');
  D('THIẾT KẾ & MINH HOẠ', 'DESIGN & ILLUSTRATION', 'デザイン＆イラスト', 'DISEÑO E ILUSTRACIÓN', 'DESIGN ET ILLUSTRATION');
  D('2D', '2D', '2D', '2D', '2D');
  D('3D', '3D', '3D', '3D', '3D');

  /* Nhan the loai viet thuong trong du lieu game sap ra mat */
  D('Hành động', 'Action', 'アクション', 'Acción', 'Action');
  D('Phiêu lưu', 'Adventure', 'アドベンチャー', 'Aventura', 'Aventure');
  D('Nhập vai (RPG)', 'RPG', 'RPG', 'Rol (RPG)', 'Jeu de rôle (RPG)');
  D('Chiến thuật', 'Tactics', 'タクティクス', 'Tácticas', 'Tactique');
  D('Mô phỏng', 'Simulation', 'シミュレーション', 'Simulación', 'Simulation');
  D('Truy cập sớm', 'Early Access', '早期アクセス', 'Acceso anticipado', 'Accès anticipé');

  /* ==========================================================================
     8. TRANG TICH HOP — the dich vu
     ========================================================================== */
  D('Hệ thống dịch vụ tích hợp', 'Integrated service suite', '統合サービス', 'Conjunto de servicios integrados', 'Suite de services intégrés');
  D('Năm tiện ích chạy trực tiếp trên máy bạn: đồng bộ save, cài bản Việt hóa, mở khóa game bằng AppID và thay giao diện Steam — tất cả chỉ một lần bấm.', 'Five utilities that run right on your PC: save syncing, Vietnamese patches, unlocking games by AppID and reskinning Steam — all in a single click.', 'あなたの PC で直接動く 5 つの機能: セーブ同期、ベトナム語パッチの導入、AppID によるゲーム解放、Steam の外観変更 — すべてワンクリックで。', 'Cinco utilidades que se ejecutan en tu PC: sincronizar partidas, instalar parches en vietnamita, desbloquear juegos con AppID y cambiar la interfaz de Steam, todo con un solo clic.', "Cinq utilitaires qui tournent directement sur votre PC : synchronisation des sauvegardes, patchs vietnamiens, déblocage de jeux par AppID et changement d'interface Steam — le tout en un seul clic.");
  D('CẦN THÊM GAME HOẶC GẶP LỖI?', 'NEED ANOTHER GAME, OR HIT A BUG?', 'ゲームの追加や不具合の相談は？', '¿NECESITAS OTRO JUEGO O TIENES UN ERROR?', 'BESOIN D’UN AUTRE JEU OU UN BUG ?');
  D('Gửi yêu cầu trong Discord, đội hỗ trợ sẽ xử lý trực tiếp', 'Post your request on Discord and the support team will handle it directly', 'Discord にリクエストを送れば、サポートチームが直接対応します', 'Envía tu solicitud en Discord y el equipo de soporte la atenderá directamente', "Envoyez votre demande sur Discord, l'équipe d'assistance s'en occupe directement");
  D('Vui lòng mở bằng ứng dụng Nexus Launcher.', 'Please open this in the Nexus Launcher app.', 'Nexus Launcher アプリから開いてください。', 'Ábrelo con la aplicación Nexus Launcher.', "Veuillez ouvrir ceci dans l'application Nexus Launcher.");

  /* Cloud Save */
  D('ĐỒNG BỘ DỮ LIỆU', 'DATA SYNC', 'データ同期', 'SINCRONIZACIÓN DE DATOS', 'SYNCHRONISATION DES DONNÉES');
  D('Sync save data & tiến trình chơi tự động', 'Sync save data and progress automatically', 'セーブデータと進行状況を自動同期', 'Sincroniza partidas y progreso automáticamente', 'Synchronise sauvegardes et progression automatiquement');
  D('Đồng bộ thành tích và thời gian chơi', 'Sync achievements and playtime', '実績とプレイ時間を同期', 'Sincroniza logros y tiempo de juego', 'Synchronise succès et temps de jeu');
  D('Bảo toàn dữ liệu khi đổi thiết bị', 'Keep your data when you change device', '端末を変えてもデータを保持', 'Conserva tus datos al cambiar de dispositivo', "Conserve vos données en changeant d'appareil");
  D('Dung lượng lưu trữ không giới hạn', 'Unlimited storage space', '容量無制限', 'Almacenamiento ilimitado', 'Stockage illimité');
  D('Hệ thống tự động backup an toàn', 'Safe automatic backups', '安全な自動バックアップ', 'Copias de seguridad automáticas y seguras', 'Sauvegardes automatiques sécurisées');
  D('HỆ THỐNG CLOUD', 'CLOUD SYSTEM', 'クラウド構成', 'SISTEMA EN LA NUBE', 'SYSTÈME CLOUD');
  D('Máy chủ', 'Server', 'サーバー', 'Servidor', 'Serveur');
  D('Lưu trữ trên máy chủ riêng, miễn phí', 'Hosted on a private server, free of charge', '専用サーバーで無料保管', 'Alojado en un servidor propio, gratis', 'Hébergé sur un serveur privé, gratuitement');
  D('Tự động sync', 'Auto sync', '自動同期', 'Sincronización automática', 'Synchronisation auto');
  D('Khắc phục lỗi Steam Cloud', 'Fixes Steam Cloud failures', 'Steam Cloud の不具合を解消', 'Soluciona los fallos de Steam Cloud', 'Corrige les pannes de Steam Cloud');
  D('Bảo mật', 'Security', 'セキュリティ', 'Seguridad', 'Sécurité');
  D('An toàn dữ liệu tuyệt đối', 'Absolute data safety', 'データを完全に保護', 'Seguridad total de los datos', 'Sécurité absolue des données');
  D('Dữ liệu được bảo mật tuyệt đối cho mọi trò chơi Steam.', 'Your data stays fully secure for every Steam game.', 'すべての Steam ゲームでデータを完全に保護します。', 'Tus datos están totalmente protegidos en todos los juegos de Steam.', 'Vos données restent parfaitement sécurisées pour tous les jeux Steam.');
  D('Cloud Save đã sẵn sàng', 'Cloud Save is ready', 'Cloud Save の準備完了', 'Cloud Save está listo', 'Cloud Save est prêt');
  D('Đã cài đặt Cloud Save thành công! Steam đã tự khởi chạy lại.', 'Cloud Save installed successfully. Steam has restarted itself.', 'Cloud Save をインストールしました。Steam は自動的に再起動しました。', 'Cloud Save se instaló correctamente. Steam se reinició solo.', 'Cloud Save a été installé. Steam a redémarré tout seul.');
  D('Đã cài đặt lại Cloud Save thành công! Steam đã tự khởi chạy lại.', 'Cloud Save reinstalled successfully. Steam has restarted itself.', 'Cloud Save を再インストールしました。Steam は自動的に再起動しました。', 'Cloud Save se reinstaló correctamente. Steam se reinició solo.', 'Cloud Save a été réinstallé. Steam a redémarré tout seul.');
  D('Đã gỡ cài đặt Cloud Save thành công!', 'Cloud Save uninstalled successfully.', 'Cloud Save をアンインストールしました。', 'Cloud Save se desinstaló correctamente.', 'Cloud Save a été désinstallé.');
  D('Lỗi khi gỡ cài đặt Cloud Save.', 'Failed to uninstall Cloud Save.', 'Cloud Save のアンインストールに失敗しました。', 'No se pudo desinstalar Cloud Save.', 'Échec de la désinstallation de Cloud Save.');
  D('Lỗi cài đặt lại Cloud Save.', 'Failed to reinstall Cloud Save.', 'Cloud Save の再インストールに失敗しました。', 'No se pudo reinstalar Cloud Save.', 'Échec de la réinstallation de Cloud Save.');
  D('Lỗi khi gỡ file cũ.', 'Failed to remove the old files.', '古いファイルの削除に失敗しました。', 'No se pudieron eliminar los archivos antiguos.', 'Échec de la suppression des anciens fichiers.');
  D('Steam đã tự khởi chạy lại.', 'Steam has restarted itself.', 'Steam は自動的に再起動しました。', 'Steam se reinició solo.', 'Steam a redémarré tout seul.');

  /* Canh Cut Team */
  D('DỊCH THUẬT CAO CẤP', 'PREMIUM TRANSLATION', 'プレミアム翻訳', 'TRADUCCIÓN PREMIUM', 'TRADUCTION PREMIUM');
  D('Việt hóa game AAA và Indie chất lượng cao', 'High-quality Vietnamese for AAA and indie games', 'AAA・インディーゲームの高品質ベトナム語化', 'Vietnamita de alta calidad para juegos AAA e indies', 'Traduction vietnamienne de qualité pour les jeux AAA et indés');
  D('Hơn 100 dự án lớn: Elden Ring, Wukong, MGS V', 'Over 100 major projects: Elden Ring, Wukong, MGS V', '100 以上の大型プロジェクト: Elden Ring, Wukong, MGS V', 'Más de 100 grandes proyectos: Elden Ring, Wukong, MGS V', 'Plus de 100 grands projets : Elden Ring, Wukong, MGS V');
  D('Từng câu thoại dịch tỉ mỉ, sắc thái mượt', 'Every line translated carefully, with natural nuance', 'すべてのセリフを丁寧に、自然なニュアンスで翻訳', 'Cada línea traducida con cuidado y matices naturales', 'Chaque réplique traduite avec soin et nuance');
  D('Tích hợp launcher tự động tải và cài đặt', 'Built into the launcher: downloads and installs itself', 'ランチャー内蔵で自動ダウンロード＆インストール', 'Integrado en el launcher: se descarga e instala solo', 'Intégré au launcher : téléchargement et installation automatiques');
  D('Cập nhật bản vá mới nhất liên tục', 'Latest patches kept up to date continuously', '最新パッチを継続的に更新', 'Los últimos parches siempre actualizados', 'Derniers correctifs mis à jour en continu');
  D('THÔNG TIN BẢN DỊCH', 'TRANSLATION DETAILS', '翻訳情報', 'DATOS DE LA TRADUCCIÓN', 'INFOS SUR LA TRADUCTION');
  D('Phiên bản', 'Version', 'バージョン', 'Versión', 'Version');
  D('Patch Việt hóa mới nhất', 'Latest Vietnamese patch', '最新のベトナム語パッチ', 'Último parche en vietnamita', 'Dernier patch vietnamien');
  D('Nhóm dịch', 'Translation team', '翻訳チーム', 'Equipo de traducción', 'Équipe de traduction');
  D('Hỗ trợ', 'Supported on', '対応環境', 'Compatible con', 'Compatible avec');
  D('PC Win 10/11 và Steam Deck', 'PC Win 10/11 and Steam Deck', 'PC Win 10/11 と Steam Deck', 'PC Win 10/11 y Steam Deck', 'PC Win 10/11 et Steam Deck');
  D('PC Win 10/11', 'PC Win 10/11', 'PC Win 10/11', 'PC Win 10/11', 'PC Win 10/11');
  D('Bản dịch độc quyền được thực hiện bởi Cánh Cụt Team.', 'An exclusive translation made by Cánh Cụt Team.', 'Cánh Cụt Team による独占翻訳です。', 'Traducción exclusiva realizada por Cánh Cụt Team.', 'Traduction exclusive réalisée par Cánh Cụt Team.');

  /* Game Thuan Viet */
  D('GAME THUẦN VIỆT', 'FULLY VIETNAMESE GAMES', '完全ベトナム語版ゲーム', 'JUEGOS EN VIETNAMITA', 'JEUX ENTIÈREMENT EN VIETNAMIEN');
  D('VIỆT HÓA TOÀN DIỆN', 'FULL VIETNAMESE', '完全ベトナム語化', 'VIETNAMITA COMPLETO', 'VIETNAMIEN INTÉGRAL');
  D('Chuyển ngữ thủ công, giữ tinh thần bản gốc', 'Translated by hand, keeping the spirit of the original', '手作業で翻訳し、原作の雰囲気を維持', 'Traducción manual que conserva el espíritu original', "Traduction manuelle fidèle à l'esprit d'origine");
  D('Chất lượng thật — cảm xúc thật', 'Real quality, real feeling', '本物の品質、本物の感動', 'Calidad real, emoción real', 'Une vraie qualité, une vraie émotion');
  D('Cài đặt 1-click, tự động nhận đường dẫn', 'One-click install that finds the folder for you', 'ワンクリックでインストール、フォルダーを自動検出', 'Instalación en un clic que detecta la carpeta sola', 'Installation en un clic avec détection du dossier');
  D('Tương thích 100% Windows 10/11 mới nhất', '100% compatible with the latest Windows 10/11', '最新の Windows 10/11 に 100% 対応', '100% compatible con los últimos Windows 10/11', 'Compatible à 100 % avec les dernières versions de Windows 10/11');
  D('Tối ưu UI/HUD tiếng Việt chuẩn nét', 'Sharp, well-tuned Vietnamese UI and HUD', 'ベトナム語の UI/HUD を鮮明に最適化', 'UI y HUD en vietnamita nítidos y bien ajustados', 'UI et HUD vietnamiens nets et optimisés');
  D('ĐẶC TÍNH BẢN DỊCH', 'TRANSLATION FEATURES', '翻訳の特徴', 'CARACTERÍSTICAS DE LA TRADUCCIÓN', 'CARACTÉRISTIQUES DE LA TRADUCTION');
  D('Dịch thuật', 'Translation', '翻訳', 'Traducción', 'Traduction');
  D('100% chuyển ngữ thủ công', '100% translated by hand', '100% 手作業翻訳', '100% traducido a mano', '100 % traduit à la main');
  D('Giao diện', 'Interface', 'インターフェース', 'Interfaz', 'Interface');
  D('Tối ưu UI/HUD chuẩn nét', 'Sharp, well-tuned UI and HUD', 'UI/HUD を鮮明に最適化', 'UI y HUD nítidos y ajustados', 'UI et HUD nets et optimisés');
  D('Cài đặt', 'Installation', 'インストール', 'Instalación', 'Installation');
  D('Tự động 1-click nhanh chóng', 'Fast, automatic, one click', 'ワンクリックで素早く自動', 'Rápida y automática con un clic', 'Rapide et automatique en un clic');
  D('Trải nghiệm Việt hóa chuẩn nhất bởi Game Thuần Việt.', 'The most faithful Vietnamese experience, by Game Thuần Việt.', 'Game Thuần Việt による最も忠実なベトナム語体験。', 'La experiencia en vietnamita más fiel, por Game Thuần Việt.', 'L’expérience vietnamienne la plus fidèle, par Game Thuần Việt.');

  /* Easy-Install (AppID) */
  D('CHIA SẺ GAME', 'GAME SHARING', 'ゲーム共有', 'COMPARTIR JUEGOS', 'PARTAGE DE JEUX');
  D('Tự động thêm và mở khóa game qua Steam', 'Adds and unlocks games through Steam automatically', 'Steam 経由でゲームを自動追加・解放', 'Añade y desbloquea juegos en Steam automáticamente', 'Ajoute et débloque les jeux via Steam automatiquement');
  D('Chơi ngay lập tức chỉ với một AppID', 'Play instantly with nothing but an AppID', 'AppID ひとつですぐにプレイ', 'Juega al instante solo con un AppID', 'Jouez immédiatement avec un simple AppID');
  D('Tự động tải và cập nhật file manifest Lua', 'Downloads and updates the Lua manifest files for you', 'Lua マニフェストを自動ダウンロード・更新', 'Descarga y actualiza los archivos manifest de Lua', 'Télécharge et met à jour les fichiers manifest Lua');
  D('Kho AppID mở rộng liên tục theo yêu cầu', 'The AppID library keeps growing on request', 'リクエストに応じて AppID 在庫を随時拡大', 'La biblioteca de AppID crece según las peticiones', 'La base d’AppID s’agrandit selon les demandes');
  D('Không cần thao tác thủ công với Steam', 'No manual work inside Steam', 'Steam での手作業は不要', 'Sin tareas manuales en Steam', 'Aucune manipulation manuelle dans Steam');
  D('CÁCH SỬ DỤNG', 'HOW TO USE', '使い方', 'CÓMO USARLO', 'MODE D’EMPLOI');
  D('Bước 1', 'Step 1', 'ステップ 1', 'Paso 1', 'Étape 1');
  D('Bước 2', 'Step 2', 'ステップ 2', 'Paso 2', 'Étape 2');
  D('Bước 3', 'Step 3', 'ステップ 3', 'Paso 3', 'Étape 3');
  D('Tra AppID của game trên SteamDB', "Look up the game's AppID on SteamDB", 'SteamDB でゲームの AppID を調べる', 'Busca el AppID del juego en SteamDB', "Cherchez l'AppID du jeu sur SteamDB");
  D('Dán AppID vào ô bên dưới', 'Paste the AppID into the box below', '下の欄に AppID を貼り付ける', 'Pega el AppID en el campo de abajo', "Collez l'AppID dans le champ ci-dessous");
  D('Bấm Kích hoạt rồi mở lại Steam', 'Press Activate, then restart Steam', '「認証」を押して Steam を再起動', 'Pulsa Activar y reinicia Steam', 'Appuyez sur Activer puis relancez Steam');
  D('CÁC TRÒ CHƠI KHÔNG HỖ TRỢ', 'GAMES THAT ARE NOT SUPPORTED', '対応していないゲーム', 'JUEGOS NO COMPATIBLES', 'JEUX NON PRIS EN CHARGE');
  D('Launcher bên thứ 3 (Uplay/EA)', 'Third-party launchers (Uplay/EA)', 'サードパーティのランチャー (Uplay/EA)', 'Launchers de terceros (Uplay/EA)', 'Launchers tiers (Uplay/EA)');
  D('Trò chơi có thể phát sinh trục trặc — hãy tham gia Discord để được hỗ trợ và yêu cầu thêm game.', 'A game may still misbehave — join Discord for help or to request more games.', 'ゲームによっては不具合が出ることがあります。Discord でサポートや追加リクエストをどうぞ。', 'Algún juego puede fallar: entra en Discord para pedir ayuda o solicitar más juegos.', 'Un jeu peut poser problème — rejoignez Discord pour de l’aide ou pour demander d’autres jeux.');
  D('Nhập AppID, ví dụ 1245620', 'Enter an AppID, for example 1245620', 'AppID を入力 (例: 1245620)', 'Introduce un AppID, por ejemplo 1245620', 'Saisissez un AppID, par exemple 1245620');
  D('Tra AppID trên Steam', 'Look up the AppID on Steam', 'Steam で AppID を調べる', 'Buscar el AppID en Steam', "Rechercher l'AppID sur Steam");
  D('Vui lòng nhập AppID game.', 'Please enter the game AppID.', 'ゲームの AppID を入力してください。', 'Introduce el AppID del juego.', "Veuillez saisir l'AppID du jeu.");
  D('Đã kích hoạt thành công trò chơi có AppID {id}', 'Successfully activated the game with AppID: {id}', 'AppID {id} のゲームを認証しました', 'Se activó correctamente el juego con AppID: {id}', 'Jeu avec AppID {id} activé avec succès');
  D('Máy chủ hiện chưa có trò chơi nào mang AppID {id}', 'The server currently has no game with AppID: {id}', '現在サーバーに AppID {id} のゲームはありません', 'El servidor no tiene ningún juego con AppID: {id}', "Le serveur n'a aucun jeu avec l'AppID : {id}");
  D('Đã kích hoạt AppID {id}', 'AppID {id} activated', 'AppID {id} を認証しました', 'AppID {id} activado', 'AppID {id} activé');
  D('Mở lại Steam để thấy game.', 'Restart Steam to see the game.', 'Steam を再起動するとゲームが表示されます。', 'Reinicia Steam para ver el juego.', 'Relancez Steam pour voir le jeu.');

  /* Fluenty UI */
  D('GIAO DIỆN STEAM PREMIUM', 'PREMIUM STEAM SKIN', 'プレミアム Steam スキン', 'INTERFAZ STEAM PREMIUM', 'HABILLAGE STEAM PREMIUM');
  D('Giao diện Steam phong cách Windows 11: tối giản, bo góc mượt, kính mờ sang trọng', 'A Windows 11-style Steam skin: minimal, softly rounded, elegant frosted glass', 'Windows 11 風の Steam スキン: ミニマルで角丸、上品なすりガラス', 'Interfaz de Steam al estilo Windows 11: minimalista, esquinas suaves y cristal esmerilado elegante', 'Un habillage Steam façon Windows 11 : épuré, coins arrondis, verre dépoli élégant');
  D('Tự do thay đổi bảng màu accent và font chữ', 'Change the accent palette and typeface freely', 'アクセントカラーとフォントを自由に変更', 'Cambia libremente la paleta de acento y la tipografía', 'Changez librement la palette d’accent et la police');
  D('Bố cục gọn gàng, ẩn chi tiết thừa, thư viện hiển thị đẹp hơn', 'Tidier layout, clutter hidden, a better looking library', 'すっきりした配置、余計な要素を隠し、ライブラリがより美しく', 'Diseño más limpio, detalles superfluos ocultos y una biblioteca más bonita', 'Mise en page épurée, détails superflus masqués, bibliothèque plus belle');
  D('Widget lối tắt cho bạn bè, thông báo và game yêu thích', 'Shortcut widgets for friends, notifications and favourite games', 'フレンド・通知・お気に入りゲームのショートカットウィジェット', 'Widgets de acceso rápido a amigos, notificaciones y juegos favoritos', 'Widgets de raccourci pour amis, notifications et jeux favoris');
  D('Cập nhật liên tục, tương thích mọi bản nâng cấp Steam', 'Updated continuously, compatible with every Steam upgrade', '継続的に更新され、あらゆる Steam のアップデートに対応', 'Actualización continua, compatible con cada nueva versión de Steam', 'Mises à jour continues, compatible avec toutes les versions de Steam');
  D('THÔNG TIN GÓI', 'PACKAGE DETAILS', 'パッケージ情報', 'DATOS DEL PAQUETE', 'DÉTAILS DU PAQUET');
  D('Fluenty UI Premium — bản trả phí $5, hiện miễn phí', 'Fluenty UI Premium — a $5 paid release, free right now', 'Fluenty UI Premium — 有料版 $5、現在は無料', 'Fluenty UI Premium: versión de pago de 5 $, ahora gratis', 'Fluenty UI Premium — version payante à 5 $, gratuite en ce moment');
  D('Tác giả', 'Author', '作者', 'Autor', 'Auteur');
  D('Cài đặt sẽ tự khởi động lại Steam để áp dụng giao diện mới.', 'Installing restarts Steam automatically to apply the new skin.', 'インストール時に Steam が自動再起動し、新しいスキンが適用されます。', 'La instalación reinicia Steam automáticamente para aplicar la nueva interfaz.', 'L’installation redémarre Steam automatiquement pour appliquer le nouvel habillage.');
  D('Fluenty UI đã bật', 'Fluenty UI is on', 'Fluenty UI が有効になりました', 'Fluenty UI activado', 'Fluenty UI est activé');
  D('Đã cài đặt Fluenty UI thành công! Steam đã tự khởi chạy lại.', 'Fluenty UI installed successfully. Steam has restarted itself.', 'Fluenty UI をインストールしました。Steam は自動的に再起動しました。', 'Fluenty UI se instaló correctamente. Steam se reinició solo.', 'Fluenty UI a été installé. Steam a redémarré tout seul.');
  D('Đã gỡ Fluenty UI thành công!', 'Fluenty UI uninstalled successfully.', 'Fluenty UI をアンインストールしました。', 'Fluenty UI se desinstaló correctamente.', 'Fluenty UI a été désinstallé.');
  D('Lỗi gỡ cài đặt Fluenty UI.', 'Failed to uninstall Fluenty UI.', 'Fluenty UI のアンインストールに失敗しました。', 'No se pudo desinstalar Fluenty UI.', 'Échec de la désinstallation de Fluenty UI.');
  D('Lỗi cài đặt Fluenty UI.', 'Failed to install Fluenty UI.', 'Fluenty UI のインストールに失敗しました。', 'No se pudo instalar Fluenty UI.', 'Échec de l’installation de Fluenty UI.');

  /* Trang thai chung cua the dich vu */
  D('Cài lại', 'Reinstall', '再インストール', 'Reinstalar', 'Réinstaller');
  D('Gỡ bỏ', 'Remove', '削除', 'Quitar', 'Retirer');
  D('ĐANG BẬT', 'ENABLED', '有効', 'ACTIVADO', 'ACTIVÉ');
  D('KÍCH HOẠT NGAY', 'ACTIVATE NOW', '今すぐ有効化', 'ACTIVAR AHORA', 'ACTIVER MAINTENANT');
  D('MỞ CÔNG CỤ', 'OPEN THE TOOL', 'ツールを開く', 'ABRIR LA HERRAMIENTA', "OUVRIR L'OUTIL");
  D('GỠ CÀI ĐẶT', 'UNINSTALL', 'アンインストール', 'DESINSTALAR', 'DÉSINSTALLER');
  D('Đang kiểm tra...', 'Checking…', '確認中…', 'Comprobando…', 'Vérification…');
  D('Đang cài đặt...', 'Installing…', 'インストール中…', 'Instalando…', 'Installation…');
  D('Đang gỡ...', 'Removing…', '削除中…', 'Quitando…', 'Suppression…');
  D('Đang kích hoạt...', 'Activating…', '認証中…', 'Activando…', 'Activation…');
  D('Không thể khởi chạy tool.', 'Could not launch the tool.', 'ツールを起動できませんでした。', 'No se pudo abrir la herramienta.', "Impossible de lancer l'outil.");
  D('Lỗi cài đặt tool.', 'Failed to install the tool.', 'ツールのインストールに失敗しました。', 'No se pudo instalar la herramienta.', "Échec de l'installation de l'outil.");
  D('Lỗi không xác định.', 'Unknown error.', '不明なエラーです。', 'Error desconocido.', 'Erreur inconnue.');

  /* ==========================================================================
     9. TRANG CHI TIET GAME — mo ta, thong so, media
     ========================================================================== */
  D('Giới thiệu', 'About this game', 'このゲームについて', 'Acerca del juego', 'À propos du jeu');
  D('Đang dịch', 'Translating', '翻訳中', 'Traduciendo', 'Traduction en cours');
  D('Đang tải mô tả', 'Loading the description', '説明を読み込み中', 'Cargando la descripción', 'Chargement de la description');
  D('Chưa có mô tả cho trò chơi này.', 'There is no description for this game yet.', 'このゲームの説明はまだありません。', 'Todavía no hay descripción para este juego.', "Aucune description n'est encore disponible pour ce jeu.");
  D('Đọc thêm', 'Read more', '続きを読む', 'Leer más', 'Lire la suite');
  D('Thu gọn', 'Show less', '折りたたむ', 'Mostrar menos', 'Réduire');
  D('Nhà phát hành đã viết sẵn bản tiếng Việt trên Steam', 'The publisher already provides a Vietnamese page on Steam', 'パブリッシャーが Steam にベトナム語ページを用意しています', 'La editora ya ofrece una página en vietnamita en Steam', "L'éditeur propose déjà une page en vietnamien sur Steam");
  D('Trang Steam của trò chơi này chỉ có {lang}', 'The Steam page for this game is only available in {lang}', 'このゲームの Steam ページは {lang} のみです', 'La página de Steam de este juego solo está en {lang}', 'La page Steam de ce jeu n’existe qu’en {lang}');
  D('Bản dịch tự động — bản gốc do nhà phát hành viết bằng {lang}.', 'Machine translation — the original was written by the publisher in {lang}.', '自動翻訳です。原文はパブリッシャーが {lang} で執筆しました。', 'Traducción automática: el texto original lo escribió la editora en {lang}.', "Traduction automatique — le texte d'origine a été écrit par l'éditeur en {lang}.");
  D('Tiếng Anh', 'English', '英語', 'inglés', 'anglais');
  D('ngoại ngữ', 'a foreign language', '外国語', 'otro idioma', 'une langue étrangère');
  D('Không tải được video này', 'This video could not be loaded', 'この動画を読み込めませんでした', 'No se pudo cargar este vídeo', 'Impossible de charger cette vidéo');

  /* Bang thong so */
  D('Chế độ', 'Mode', 'モード', 'Modo', 'Mode');
  D('Trực tuyến', 'Online', 'オンライン', 'En línea', 'En ligne');
  D('Ngoại tuyến', 'Offline', 'オフライン', 'Sin conexión', 'Hors ligne');
  D('Yêu cầu', 'Requirement', '必要条件', 'Requisito', 'Prérequis');
  D('Miễn phí', 'Free', '無料', 'Gratis', 'Gratuit');
  D('Có hỗ trợ', 'Supported', '対応', 'Compatible', 'Pris en charge');
  D('Không hỗ trợ', 'Not supported', '非対応', 'No compatible', 'Non pris en charge');
  D('Nền tảng', 'Platform', 'プラットフォーム', 'Plataforma', 'Plateforme');
  D('Nhà phát triển', 'Developer', '開発元', 'Desarrolladora', 'Développeur');
  D('Nhà phát hành', 'Publisher', '販売元', 'Editora', 'Éditeur');
  D('Ngày phát hành', 'Release date', '発売日', 'Fecha de lanzamiento', 'Date de sortie');
  D('Cấu hình', 'System requirements', '動作環境', 'Requisitos', 'Configuration');
  D('Chưa có dữ liệu cấu hình cho trò chơi này.', 'No system requirements are available for this game yet.', 'このゲームの動作環境データはまだありません。', 'Todavía no hay requisitos del sistema para este juego.', "Aucune configuration requise n'est disponible pour ce jeu.");
  D('CẤU HÌNH TỐI THIỂU', 'MINIMUM REQUIREMENTS', '最低動作環境', 'REQUISITOS MÍNIMOS', 'CONFIGURATION MINIMALE');
  D('CẤU HÌNH ĐỀ NGHỊ', 'RECOMMENDED REQUIREMENTS', '推奨動作環境', 'REQUISITOS RECOMENDADOS', 'CONFIGURATION RECOMMANDÉE');
  D('Hệ điều hành', 'Operating system', 'OS', 'Sistema operativo', "Système d'exploitation");
  D('Bộ xử lý', 'Processor', 'プロセッサー', 'Procesador', 'Processeur');
  D('Bộ nhớ RAM', 'Memory', 'メモリー', 'Memoria RAM', 'Mémoire vive');
  D('Đồ họa', 'Graphics', 'グラフィック', 'Gráficos', 'Carte graphique');
  D('Kết nối', 'Network', 'ネットワーク', 'Conexión', 'Connexion');
  D('Lưu trữ', 'Storage', 'ストレージ', 'Almacenamiento', 'Stockage');
  D('Ghi chú', 'Notes', '備考', 'Notas', 'Remarques');
  D('Thông tin', 'Info', '情報', 'Información', 'Infos');
  D('Xem trên Steam Store', 'View on the Steam Store', 'Steam ストアで見る', 'Ver en la tienda de Steam', 'Voir sur le Steam Store');

  /* Khoi hanh dong */
  D('TRUY CẬP GAME', 'GET THE GAME', 'ゲームを入手', 'ACCEDER AL JUEGO', 'ACCÉDER AU JEU');
  D('Click Vào Đây Để Truy Cập', 'Click here to get access', 'ここをクリックしてアクセス', 'Haz clic aquí para acceder', 'Cliquez ici pour accéder');
  D('CHƯA CÓ', 'NOT YET', '未提供', 'AÚN NO', 'PAS ENCORE');
  D('Đang Xử Lý...', 'Working…', '処理中…', 'Procesando…', 'Traitement…');
  D('Đang Kiểm Tra...', 'Checking…', '確認中…', 'Comprobando…', 'Vérification…');
  D('Đang Cài Đặt NexusT...', 'Installing NexusT…', 'NexusT をインストール中…', 'Instalando NexusT…', 'Installation de NexusT…');
  D('Đang Tắt Windows Update...', 'Turning off Windows Update…', 'Windows Update を無効化中…', 'Desactivando Windows Update…', 'Désactivation de Windows Update…');
  D('Đang Ghi Registry Xác Thực...', 'Writing the verification registry…', '認証レジストリを書き込み中…', 'Escribiendo el registro de verificación…', 'Écriture du registre de vérification…');
  D('Đang Share Game Qua Steam...', 'Sharing the game through Steam…', 'Steam でゲームを共有中…', 'Compartiendo el juego en Steam…', 'Partage du jeu via Steam…');
  D('Đang Chờ Chọn Thư Mục...', 'Waiting for you to pick a folder…', 'フォルダーの選択待ち…', 'Esperando a que elijas una carpeta…', 'En attente du choix du dossier…');
  D('Đang Kiểm Tra Dung Lượng...', 'Checking free space…', '空き容量を確認中…', 'Comprobando el espacio libre…', "Vérification de l'espace libre…");
  D('Đang Tải Game...', 'Downloading the game…', 'ゲームをダウンロード中…', 'Descargando el juego…', 'Téléchargement du jeu…');
  D('Đang Cài Đặt Game...', 'Installing the game…', 'ゲームをインストール中…', 'Instalando el juego…', 'Installation du jeu…');
  D('Đang giải nén và cài đặt, vui lòng đợi vài phút...', 'Extracting and installing — this takes a few minutes…', '展開してインストール中です。数分お待ちください…', 'Extrayendo e instalando, espera unos minutos…', 'Extraction et installation en cours, patientez quelques minutes…');
  D('Đang khởi tạo tiến trình tải...', 'Starting the download…', 'ダウンロードを開始しています…', 'Iniciando la descarga…', 'Démarrage du téléchargement…');
  D('Sẵn sàng khởi chạy', 'Ready to play', 'プレイ準備完了', 'Listo para jugar', 'Prêt à jouer');
  D('Khởi Chạy', 'Play', 'プレイ', 'Jugar', 'Jouer');
  D('Thư Mục', 'Folder', 'フォルダー', 'Carpeta', 'Dossier');
  D('Gỡ Cài Đặt', 'Uninstall', 'アンインストール', 'Desinstalar', 'Désinstaller');
  D('Gỡ cài đặt', 'Uninstall', 'アンインストール', 'Desinstalar', 'Désinstaller');
  D('THAY ĐỔI NGÔN NGỮ', 'CHANGE THE LANGUAGE', '言語を変更', 'CAMBIAR EL IDIOMA', 'CHANGER DE LANGUE');
  D('Thay Đổi Ngôn Ngữ', 'Change the language', '言語を変更', 'Cambiar el idioma', 'Changer de langue');
  D('ĐANG DÙNG: {lang}', 'CURRENTLY: {lang}', '現在: {lang}', 'EN USO: {lang}', 'ACTUEL : {lang}');
  D('Đang đổi...', 'Changing…', '変更中…', 'Cambiando…', 'Changement…');
  D('SỬA LỖI KẾT NỐI', 'FIX THE CONNECTION', '接続を修復', 'REPARAR LA CONEXIÓN', 'RÉPARER LA CONNEXION');
  D('Fix Game', 'Fix the game', 'ゲームを修復', 'Reparar el juego', 'Réparer le jeu');
  D('Đang Fix Game...', 'Fixing the game…', 'ゲームを修復中…', 'Reparando el juego…', 'Réparation du jeu…');
  D('NHẬP 6 KÝ TỰ', 'ENTER 6 CHARACTERS', '6 文字を入力', 'INTRODUCE 6 CARACTERES', 'SAISISSEZ 6 CARACTÈRES');
  D('Kích hoạt', 'Activate', '認証する', 'Activar', 'Activer');
  D('Đang xử lý', 'Working', '処理中', 'Procesando', 'Traitement');
  D('Bắt đầu tải', 'Start the download', 'ダウンロード開始', 'Empezar la descarga', 'Lancer le téléchargement');
  D('Chọn vị trí cài đặt', 'Choose where to install', 'インストール先を選択', 'Elige dónde instalar', "Choisissez l'emplacement d'installation");
  D('Cần tối thiểu {s} dung lượng trống', 'At least {s} of free space is required', '空き容量が最低 {s} 必要です', 'Se necesitan al menos {s} de espacio libre', 'Au moins {s} d’espace libre sont nécessaires');
  D('Dung lượng tải về:', 'Download size:', 'ダウンロード容量:', 'Tamaño de la descarga:', 'Taille du téléchargement :');
  D('Gỡ cài đặt trò chơi?', 'Uninstall this game?', 'このゲームをアンインストールしますか？', '¿Desinstalar este juego?', 'Désinstaller ce jeu ?');
  D('Toàn bộ thư mục game sẽ bị xóa và không thể hoàn tác.', 'The whole game folder will be deleted and this cannot be undone.', 'ゲームフォルダーがすべて削除され、元に戻せません。', 'Se borrará toda la carpeta del juego y no se puede deshacer.', 'Tout le dossier du jeu sera supprimé, sans retour possible.');
  D('Ngôn ngữ cho Palworld', 'Language for Palworld', 'Palworld の言語', 'Idioma para Palworld', 'Langue pour Palworld');
  D('Thay đổi chỉ áp dụng khi khởi động lại game.', 'The change only applies after you restart the game.', '変更はゲームを再起動してから反映されます。', 'El cambio solo se aplica al reiniciar el juego.', 'Le changement ne prend effet qu’après le redémarrage du jeu.');
  D('HỖ TRỢ & CẬP NHẬT', 'SUPPORT & UPDATES', 'サポート＆アップデート', 'SOPORTE Y ACTUALIZACIONES', 'ASSISTANCE ET MISES À JOUR');
  D('Tham gia Discord để nhận thông tin mới nhất', 'Join Discord to get the latest news', 'Discord に参加して最新情報を受け取ろう', 'Únete a Discord para recibir las últimas novedades', 'Rejoignez Discord pour les dernières nouvelles');
  D('HỖ TRỢ VIỆT HÓA', 'VIETNAMESE SUPPORT', 'ベトナム語サポート', 'SOPORTE EN VIETNAMITA', 'PRISE EN CHARGE DU VIETNAMIEN');
  D('Tải bản dịch tiếng Việt từ The Red Team', 'Download the Vietnamese translation from The Red Team', 'The Red Team のベトナム語訳をダウンロード', 'Descarga la traducción al vietnamita de The Red Team', 'Téléchargez la traduction vietnamienne de The Red Team');

  /* Thong bao ket qua tren trang chi tiet */
  D('Sai Mã, Vui Lòng Thử Lại', 'Wrong code, please try again', 'コードが違います。もう一度お試しください', 'Código incorrecto, inténtalo de nuevo', 'Code incorrect, veuillez réessayer');
  D('Bạn Chưa Cài Đặt NexusT', 'You have not installed NexusT', 'NexusT がインストールされていません', 'No tienes NexusT instalado', "Vous n'avez pas installé NexusT");
  D('Code Này Phải Kích Hoạt Ở Game Khác', 'This code belongs to a different game', 'このコードは別のゲーム用です', 'Este código pertenece a otro juego', "Ce code appartient à un autre jeu");
  D('Đã Kích Hoạt Game Thành Công', 'The game was activated successfully', 'ゲームの認証に成功しました', 'El juego se activó correctamente', 'Le jeu a bien été activé');
  D('(còn {n} lượt)', '({n} uses left)', '(残り {n} 回)', '(quedan {n} usos)', '({n} utilisations restantes)');
  D('Kích hoạt thành công', 'Activated successfully', '認証に成功しました', 'Activado correctamente', 'Activation réussie');
  D('Chưa Cài Đặt Steam, Vui Lòng Cài Đặt Steam Trước Khi Fix Game', 'Steam is not installed. Please install Steam before fixing the game.', 'Steam が未インストールです。ゲームを修復する前に Steam を入れてください。', 'Steam no está instalado. Instálalo antes de reparar el juego.', "Steam n'est pas installé. Installez-le avant de réparer le jeu.");
  D('Bạn chưa cài đặt game', 'You have not installed this game', 'このゲームはインストールされていません', 'No tienes este juego instalado', "Vous n'avez pas installé ce jeu");
  D('Đã Fix Game Hoàn Tất', 'The game was fixed successfully', 'ゲームの修復が完了しました', 'El juego se reparó correctamente', 'La réparation du jeu est terminée');
  D('Đã fix game hoàn tất', 'The game was fixed successfully', 'ゲームの修復が完了しました', 'El juego se reparó correctamente', 'La réparation du jeu est terminée');
  D('Lỗi: Không fix được game', 'Error: the game could not be fixed', 'エラー: ゲームを修復できませんでした', 'Error: no se pudo reparar el juego', 'Erreur : impossible de réparer le jeu');
  D('Chưa Cài Đặt Steam', 'Steam is not installed', 'Steam が未インストールです', 'Steam no está instalado', "Steam n'est pas installé");
  D('Vui lòng cài Steam trước khi đổi ngôn ngữ.', 'Please install Steam before changing the language.', '言語を変更する前に Steam をインストールしてください。', 'Instala Steam antes de cambiar el idioma.', 'Installez Steam avant de changer la langue.');
  D('Đã đổi ngôn ngữ thành {lang}', 'Language changed to {lang}', '言語を {lang} に変更しました', 'Idioma cambiado a {lang}', 'Langue changée en {lang}');
  D('Thay đổi áp dụng khi khởi động lại Palworld.', 'The change applies when Palworld restarts.', 'Palworld を再起動すると反映されます。', 'El cambio se aplica al reiniciar Palworld.', 'Le changement prend effet au redémarrage de Palworld.');
  D('Không đổi được ngôn ngữ', 'Could not change the language', '言語を変更できませんでした', 'No se pudo cambiar el idioma', 'Impossible de changer la langue');
  D('Vui lòng thử lại.', 'Please try again.', 'もう一度お試しください。', 'Inténtalo de nuevo.', 'Veuillez réessayer.');
  D('Chưa Cài Đặt Steam, Vui Lòng Cài Đặt Steam Trước', 'Steam is not installed. Please install Steam first.', 'Steam が未インストールです。先に Steam を入れてください。', 'Steam no está instalado. Instálalo primero.', "Steam n'est pas installé. Installez-le d'abord.");
  D('Lỗi: Không cài đặt được NexusT', 'Error: NexusT could not be installed', 'エラー: NexusT をインストールできませんでした', 'Error: no se pudo instalar NexusT', "Erreur : impossible d'installer NexusT");
  D('Đã Tắt Windows Update Hoàn Tất', 'Windows Update has been turned off', 'Windows Update を無効化しました', 'Windows Update se ha desactivado', 'Windows Update a été désactivé');
  D('Lỗi: Không nhận được phản hồi', 'Error: no response received', 'エラー: 応答がありません', 'Error: no se recibió respuesta', 'Erreur : aucune réponse reçue');
  D('Bạn đã có trò chơi này rồi', 'You already have this game', 'このゲームはすでにお持ちです', 'Ya tienes este juego', 'Vous possédez déjà ce jeu');
  D('Đã Share Game Qua Tài Khoản Steam Của Bạn Hoàn Tất', 'The game has been shared to your Steam account', 'あなたの Steam アカウントにゲームを共有しました', 'El juego se compartió con tu cuenta de Steam', 'Le jeu a été partagé sur votre compte Steam');
  D('Đã thêm game vào Steam', 'The game was added to Steam', 'ゲームを Steam に追加しました', 'Se añadió el juego a Steam', 'Le jeu a été ajouté à Steam');
  D('Lỗi: Không share được game', 'Error: the game could not be shared', 'エラー: ゲームを共有できませんでした', 'Error: no se pudo compartir el juego', 'Erreur : impossible de partager le jeu');
  D('Lỗi: Không lấy được dung lượng file từ Buzzheavier', 'Error: could not read the file size from Buzzheavier', 'エラー: Buzzheavier からファイルサイズを取得できませんでした', 'Error: no se pudo obtener el tamaño del archivo de Buzzheavier', 'Erreur : impossible de lire la taille du fichier depuis Buzzheavier');
  D('Không Đủ Dung Lượng Hệ Thống', 'Not enough space on the system', 'システムの空き容量が足りません', 'No hay suficiente espacio en el sistema', 'Espace disque insuffisant');
  D('Cần khoảng {s} trống.', 'About {s} of free space is needed.', '約 {s} の空き容量が必要です。', 'Se necesitan unos {s} libres.', 'Environ {s} d’espace libre sont nécessaires.');
  D('Cài đặt hoàn tất', 'Installation complete', 'インストール完了', 'Instalación completada', 'Installation terminée');
  D('Không cài đặt được game', 'The game could not be installed', 'ゲームをインストールできませんでした', 'No se pudo instalar el juego', "Impossible d'installer le jeu");
  D('Đang Khởi Chạy Game', 'Launching the game', 'ゲームを起動中', 'Iniciando el juego', 'Lancement du jeu');
  D('Vui Lòng Đợi...', 'Please wait…', 'お待ちください…', 'Espera un momento…', 'Veuillez patienter…');
  D('Không khởi chạy được', 'Could not launch', '起動できませんでした', 'No se pudo iniciar', 'Impossible de lancer');
  D('Không mở được thư mục', 'Could not open the folder', 'フォルダーを開けませんでした', 'No se pudo abrir la carpeta', "Impossible d'ouvrir le dossier");
  D('Đã gỡ cài đặt', 'Uninstalled', 'アンインストールしました', 'Desinstalado', 'Désinstallé');
  D('Không gỡ được game', 'Could not uninstall the game', 'ゲームをアンインストールできませんでした', 'No se pudo desinstalar el juego', 'Impossible de désinstaller le jeu');
  D('Lỗi: {e}', 'Error: {e}', 'エラー: {e}', 'Error: {e}', 'Erreur : {e}');

  /* Ten cac ngon ngu trong danh sach cua Palworld */
  D('Trung Giản Thể', 'Simplified Chinese', '簡体字中国語', 'Chino simplificado', 'Chinois simplifié');
  D('Trung Phồn Thể', 'Traditional Chinese', '繁体字中国語', 'Chino tradicional', 'Chinois traditionnel');
  D('Tiếng Nhật', 'Japanese', '日本語', 'Japonés', 'Japonais');
  D('Tiếng Pháp', 'French', 'フランス語', 'Francés', 'Français');
  D('Tiếng Ý', 'Italian', 'イタリア語', 'Italiano', 'Italien');
  D('Tiếng Đức', 'German', 'ドイツ語', 'Alemán', 'Allemand');
  D('Tây Ban Nha', 'Spanish', 'スペイン語', 'Español', 'Espagnol');
  D('Bồ Đào Nha (Brazil)', 'Portuguese (Brazil)', 'ポルトガル語 (ブラジル)', 'Portugués (Brasil)', 'Portugais (Brésil)');
  D('Tiếng Nga', 'Russian', 'ロシア語', 'Ruso', 'Russe');
  D('Tiếng Hàn', 'Korean', '韓国語', 'Coreano', 'Coréen');
  D('Tiếng Indonesia', 'Indonesian', 'インドネシア語', 'Indonesio', 'Indonésien');
  D('Tây Ban Nha (Mỹ Latin)', 'Spanish (Latin America)', 'スペイン語 (ラテンアメリカ)', 'Español (Latinoamérica)', 'Espagnol (Amérique latine)');
  D('Tiếng Thái', 'Thai', 'タイ語', 'Tailandés', 'Thaï');
  D('Tiếng Thổ Nhĩ Kỳ', 'Turkish', 'トルコ語', 'Turco', 'Turc');
  D('Tiếng Việt', 'Vietnamese', 'ベトナム語', 'Vietnamita', 'Vietnamien');
  D('Tiếng Ba Lan', 'Polish', 'ポーランド語', 'Polaco', 'Polonais');
  D('Tiếng Tây Ban Nha', 'Spanish', 'スペイン語', 'Español', 'Espagnol');

  /* ==========================================================================
     11. TRANG CHI TIET — BO SUNG: bai gioi thieu, thong bao, nut bam
     ========================================================================== */

  /* Dai so lieu dau bai gioi thieu */
  D('Nhà phát hành đã viết sẵn bản này trên Steam', 'The publisher already provides this version on Steam', 'パブリッシャーがこの言語版を Steam に用意しています', 'El editor ya ofrece esta versión en Steam', "L'éditeur propose déjà cette version sur Steam");
  D('Thời gian đọc ước tính', 'Estimated reading time', '推定読了時間', 'Tiempo de lectura estimado', 'Temps de lecture estimé');
  D('{n} phút đọc', '{n} min read', '約 {n} 分', '{n} min de lectura', '{n} min de lecture');
  D('Ảnh và video kèm trong bài giới thiệu', 'Images and videos included in the description', '紹介文に含まれる画像と動画', 'Imágenes y vídeos incluidos en la descripción', 'Images et vidéos incluses dans la description');
  D('Bản dịch chính thức của nhà phát hành', 'Official translation by the publisher', 'パブリッシャーによる公式翻訳', 'Traducción oficial del editor', "Traduction officielle de l'éditeur");
  D('Chính chủ', 'Official', '公式', 'Oficial', 'Officiel');
  D('Bản dịch do máy thực hiện', 'Machine translation', '機械翻訳です', 'Traducción automática', 'Traduction automatique');
  D('Đã dịch', 'Translated', '翻訳済み', 'Traducido', 'Traduit');
  D('Sau', 'Next', '次へ', 'Siguiente', 'Suivant');

  /* Nut bam */
  D('Khởi chạy', 'Play', 'プレイ', 'Jugar', 'Jouer');
  D('Thư mục', 'Folder', 'フォルダー', 'Carpeta', 'Dossier');
  D('Thay đổi ngôn ngữ', 'Change language', '言語を変更', 'Cambiar idioma', 'Changer de langue');
  D('Đang fix game...', 'Fixing game...', '修復中...', 'Reparando juego...', 'Réparation en cours...');
  D('Đang xử lý...', 'Working...', '処理中...', 'Procesando...', 'Traitement...');
  D('Cần tối thiểu {size} dung lượng trống', 'At least {size} of free space is required', '最低 {size} の空き容量が必要です', 'Se requieren al menos {size} de espacio libre', "Au moins {size} d'espace libre sont requis");

  /* Kich hoat ma */
  D('Sai mã, vui lòng thử lại', 'Invalid code, please try again', 'コードが正しくありません。もう一度お試しください', 'Código incorrecto, inténtalo de nuevo', 'Code incorrect, veuillez réessayer');
  D('Bạn chưa cài đặt NexusT', 'You have not installed NexusT yet', 'NexusT がインストールされていません', 'Aún no has instalado NexusT', "Vous n'avez pas encore installé NexusT");
  D('Mã này phải kích hoạt ở trò chơi khác', 'This code must be redeemed on a different game', 'このコードは別のゲームで使用してください', 'Este código debe canjearse en otro juego', 'Ce code doit être utilisé sur un autre jeu');
  D('Đã kích hoạt trò chơi thành công', 'Game activated successfully', 'ゲームを正常にアクティベートしました', 'Juego activado correctamente', 'Jeu activé avec succès');

  /* Sua loi & Steam */
  D('Chưa cài đặt Steam, vui lòng cài Steam trước khi fix game', 'Steam is not installed — please install Steam before fixing the game', 'Steam がインストールされていません。修復の前に Steam をインストールしてください', 'Steam no está instalado; instálalo antes de reparar el juego', "Steam n'est pas installé ; installez-le avant de réparer le jeu");
  D('Chưa cài đặt Steam, vui lòng cài Steam trước', 'Steam is not installed — please install Steam first', 'Steam がインストールされていません。先に Steam をインストールしてください', 'Steam no está instalado; instálalo primero', "Steam n'est pas installé ; installez-le d'abord");
  D('Bạn chưa cài đặt trò chơi này', 'You have not installed this game', 'このゲームはインストールされていません', 'No tienes este juego instalado', "Vous n'avez pas installé ce jeu");
  D('Lỗi: không fix được game', 'Error: could not fix the game', 'エラー: ゲームを修復できませんでした', 'Error: no se pudo reparar el juego', 'Erreur : impossible de réparer le jeu');
  D('Lỗi: không cài đặt được NexusT', 'Error: could not install NexusT', 'エラー: NexusT をインストールできませんでした', 'Error: no se pudo instalar NexusT', "Erreur : impossible d'installer NexusT");
  D('Đã tắt Windows Update hoàn tất', 'Windows Update has been turned off', 'Windows Update を無効にしました', 'Windows Update se ha desactivado', 'Windows Update a été désactivé');
  D('Lỗi: không nhận được phản hồi', 'Error: no response received', 'エラー: 応答がありませんでした', 'Error: no se recibió respuesta', 'Erreur : aucune réponse reçue');
  D('Đã thêm trò chơi vào tài khoản Steam của bạn', 'The game has been added to your Steam account', 'ゲームをあなたの Steam アカウントに追加しました', 'El juego se ha añadido a tu cuenta de Steam', 'Le jeu a été ajouté à votre compte Steam');
  D('Đã thêm trò chơi vào Steam', 'Game added to Steam', 'ゲームを Steam に追加しました', 'Juego añadido a Steam', 'Jeu ajouté à Steam');
  D('Lỗi: không thêm được trò chơi', 'Error: could not add the game', 'エラー: ゲームを追加できませんでした', 'Error: no se pudo añadir el juego', "Erreur : impossible d'ajouter le jeu");

  /* Tai ve & cai dat */
  D('Lỗi: không lấy được dung lượng tệp từ Buzzheavier', 'Error: could not read the file size from Buzzheavier', 'エラー: Buzzheavier からファイルサイズを取得できませんでした', 'Error: no se pudo obtener el tamaño del archivo de Buzzheavier', 'Erreur : impossible de lire la taille du fichier depuis Buzzheavier');
  D('Ổ đĩa không đủ dung lượng trống', 'Not enough free space on the drive', 'ドライブの空き容量が足りません', 'No hay suficiente espacio libre en el disco', 'Espace disque insuffisant');
  D('Cần khoảng {size} trống.', 'About {size} of free space is needed.', '約 {size} の空き容量が必要です。', 'Se necesitan unos {size} libres.', "Environ {size} d'espace libre sont nécessaires.");
  D('không cài đặt được trò chơi', 'could not install the game', 'ゲームをインストールできませんでした', 'no se pudo instalar el juego', "impossible d'installer le jeu");
  D('Đang khởi chạy trò chơi', 'Launching the game', 'ゲームを起動しています', 'Iniciando el juego', 'Lancement du jeu');
  D('Vui lòng đợi...', 'Please wait...', 'お待ちください...', 'Espera un momento...', 'Veuillez patienter...');
  D('Không gỡ được trò chơi', 'Could not uninstall the game', 'ゲームをアンインストールできませんでした', 'No se pudo desinstalar el juego', 'Impossible de désinstaller le jeu');

  /* ==========================================================================
     BO MAY
     ========================================================================== */
  var STORE_KEY = 'nx.lang';
  var cur = 'vi';
  var subs = [];

  function byCode(c) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === c) return LANGS[i];
    return null;
  }

  /* Ngon ngu lan truoc, neu chua tung chon thi doan theo ngon ngu cua may */
  (function boot() {
    var saved = null;
    try { saved = localStorage.getItem(STORE_KEY); } catch (e) { /* che do rieng tu */ }
    if (saved && byCode(saved)) { cur = saved; return; }
    var nav = (navigator.language || 'vi').toLowerCase();
    for (var i = 0; i < LANGS.length; i++) {
      if (nav.indexOf(LANGS[i].code) === 0) { cur = LANGS[i].code; return; }
    }
  })();

  /* Thay {ten} bang gia tri that */
  function fill(s, vars) {
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, function (m, k) {
      return vars[k] === undefined || vars[k] === null ? m : String(vars[k]);
    });
  }

  /* Ham dich. Nhan cau tieng Viet goc, tra ve cau theo ngon ngu dang chon.
     Khong tim thay thi tra lai chinh cau tieng Viet — khong bao gio de trong. */
  function TX(s, vars) {
    if (s === null || s === undefined) return s;
    var src = String(s);
    if (cur === 'vi') return fill(src, vars);
    var row = DICT[src];
    if (row) {
      var v = row[IDX[cur]];
      if (v) return fill(v, vars);
    }
    return fill(src, vars);
  }

  /* Bo chu rieng cho tieng Nhat — chi tai khi that su can den */
  var jpLoaded = false;
  function ensureJapaneseFont() {
    if (jpLoaded) return;
    jpLoaded = true;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;800;900&display=swap';
    document.head.appendChild(l);
  }

  function apply() {
    var L = byCode(cur) || LANGS[0];
    var h = document.documentElement;
    h.setAttribute('lang', L.html);
    h.setAttribute('data-lang', L.code);
    if (L.code === 'ja') ensureJapaneseFont();
  }

  function set(code) {
    if (!byCode(code) || code === cur) return;
    cur = code;
    try { localStorage.setItem(STORE_KEY, code); } catch (e) { /* bo qua */ }
    apply();
    for (var i = 0; i < subs.length; i++) {
      try { subs[i](cur); } catch (e) { /* mot nguoi nghe hong khong lam dung ca */ }
    }
  }

  function subscribe(fn) {
    subs.push(fn);
    return function () {
      var i = subs.indexOf(fn);
      if (i >= 0) subs.splice(i, 1);
    };
  }

  apply();

  window.NXI18N = {
    LANGS: LANGS,
    DICT: DICT,
    t: TX,
    get: function () { return cur; },
    info: function () { return byCode(cur) || LANGS[0]; },
    set: set,
    subscribe: subscribe
  };
})();
