// Character deck, grouped by series. Each character is [English, Japanese].
// English names are unique across the whole deck so no two cards read the same.

export const CATEGORIES = ['shonen', 'classics', 'recent'];

export const SERIES = [
  // ---------- Popular shonen ----------
  { id: 'naruto', name: 'Naruto', ja: 'NARUTO', category: 'shonen', chars: [
    ['Naruto', 'ナルト'], ['Sasuke', 'サスケ'], ['Sakura', 'サクラ'], ['Kakashi', 'カカシ'],
    ['Itachi', 'イタチ'], ['Gaara', '我愛羅'], ['Hinata', 'ヒナタ'], ['Jiraiya', '自来也'],
    ['Orochimaru', '大蛇丸'], ['Tsunade', '綱手'], ['Rock Lee', 'ロック・リー'], ['Shikamaru', 'シカマル'],
    ['Madara', 'マダラ'], ['Minato', 'ミナト'], ['Pain', 'ペイン'],
  ] },
  { id: 'onepiece', name: 'One Piece', ja: 'ONE PIECE', category: 'shonen', chars: [
    ['Luffy', 'ルフィ'], ['Zoro', 'ゾロ'], ['Nami', 'ナミ'], ['Usopp', 'ウソップ'],
    ['Sanji', 'サンジ'], ['Chopper', 'チョッパー'], ['Robin', 'ロビン'], ['Franky', 'フランキー'],
    ['Brook', 'ブルック'], ['Jinbe', 'ジンベエ'], ['Shanks', 'シャンクス'], ['Ace', 'エース'],
    ['Law', 'ロー'], ['Buggy', 'バギー'], ['Hancock', 'ハンコック'], ['Blackbeard', '黒ひげ'],
    ['Whitebeard', '白ひげ'], ['Kaido', 'カイドウ'], ['Mihawk', 'ミホーク'], ['Yamato', 'ヤマト'],
  ] },
  { id: 'dragonball', name: 'Dragon Ball', ja: 'ドラゴンボール', category: 'shonen', chars: [
    ['Goku', '悟空'], ['Vegeta', 'ベジータ'], ['Gohan', '悟飯'], ['Piccolo', 'ピッコロ'],
    ['Frieza', 'フリーザ'], ['Cell', 'セル'], ['Majin Buu', '魔人ブウ'], ['Krillin', 'クリリン'],
    ['Bulma', 'ブルマ'], ['Trunks', 'トランクス'], ['Beerus', 'ビルス'], ['Master Roshi', '亀仙人'],
    ['Shenron', '神龍'], ['Broly', 'ブロリー'],
  ] },
  { id: 'demonslayer', name: 'Demon Slayer', ja: '鬼滅の刃', category: 'shonen', chars: [
    ['Tanjiro', '炭治郎'], ['Nezuko', '禰豆子'], ['Zenitsu', '善逸'], ['Inosuke', '伊之助'],
    ['Giyu', '義勇'], ['Rengoku', '煉獄'], ['Shinobu', 'しのぶ'], ['Muzan', '無惨'],
    ['Tengen', '天元'], ['Mitsuri', '蜜璃'], ['Akaza', '猗窩座'],
  ] },
  { id: 'jjk', name: 'Jujutsu Kaisen', ja: '呪術廻戦', category: 'shonen', chars: [
    ['Yuji', '悠仁'], ['Megumi', '恵'], ['Nobara', '野薔薇'], ['Gojo', '五条'],
    ['Sukuna', '宿儺'], ['Nanami', '七海'], ['Geto', '夏油'], ['Toji', '甚爾'],
    ['Maki', '真希'], ['Mahito', '真人'], ['Todo', '東堂'], ['Panda', 'パンダ'],
  ] },
  { id: 'mha', name: 'My Hero Academia', ja: '僕のヒーローアカデミア', category: 'shonen', chars: [
    ['Deku', 'デク'], ['Bakugo', '爆豪'], ['Todoroki', '轟'], ['All Might', 'オールマイト'],
    ['Uraraka', '麗日'], ['Endeavor', 'エンデヴァー'], ['Shigaraki', '死柄木'], ['Dabi', '荼毘'],
    ['Aizawa', '相澤'], ['Kirishima', '切島'], ['Toga', 'トガ'], ['Hawks', 'ホークス'],
    ['Iida', '飯田'], ['Froppy', 'フロッピー'],
  ] },
  { id: 'aot', name: 'Attack on Titan', ja: '進撃の巨人', category: 'shonen', chars: [
    ['Eren', 'エレン'], ['Mikasa', 'ミカサ'], ['Armin', 'アルミン'], ['Levi', 'リヴァイ'],
    ['Erwin', 'エルヴィン'], ['Hange', 'ハンジ'], ['Reiner', 'ライナー'], ['Annie', 'アニ'],
    ['Zeke', 'ジーク'], ['Historia', 'ヒストリア'], ['Sasha', 'サシャ'], ['Jean', 'ジャン'],
  ] },
  { id: 'hxh', name: 'Hunter x Hunter', ja: 'HUNTER×HUNTER', category: 'shonen', chars: [
    ['Gon', 'ゴン'], ['Killua', 'キルア'], ['Kurapika', 'クラピカ'], ['Leorio', 'レオリオ'],
    ['Hisoka', 'ヒソカ'], ['Meruem', 'メルエム'], ['Netero', 'ネテロ'], ['Chrollo', 'クロロ'],
  ] },
  { id: 'bleach', name: 'Bleach', ja: 'BLEACH', category: 'shonen', chars: [
    ['Ichigo', '一護'], ['Rukia', 'ルキア'], ['Aizen', '藍染'], ['Byakuya', '白哉'],
    ['Kenpachi', '剣八'], ['Urahara', '浦原'], ['Orihime', '織姫'], ['Toshiro', '冬獅郎'],
    ['Yoruichi', '夜一'], ['Grimmjow', 'グリムジョー'], ['Uryu', '雨竜'],
  ] },
  { id: 'jojo', name: "JoJo's Bizarre Adventure", ja: 'ジョジョの奇妙な冒険', category: 'shonen', chars: [
    ['Jotaro', '承太郎'], ['Dio', 'ディオ'], ['Joseph', 'ジョセフ'], ['Giorno', 'ジョルノ'],
    ['Josuke', '仗助'], ['Speedwagon', 'スピードワゴン'], ['Polnareff', 'ポルナレフ'],
  ] },
  { id: 'haikyu', name: 'Haikyu!!', ja: 'ハイキュー!!', category: 'shonen', chars: [
    ['Shoyo', '翔陽'], ['Kageyama', '影山'], ['Oikawa', '及川'], ['Bokuto', '木兎'],
    ['Nishinoya', '西谷'], ['Kenma', '研磨'],
  ] },
  { id: 'fairytail', name: 'Fairy Tail', ja: 'FAIRY TAIL', category: 'shonen', chars: [
    ['Natsu', 'ナツ'], ['Lucy', 'ルーシィ'], ['Happy', 'ハッピー'], ['Erza', 'エルザ'], ['Gray', 'グレイ'],
  ] },
  { id: 'opm', name: 'One-Punch Man', ja: 'ワンパンマン', category: 'shonen', chars: [
    ['Saitama', 'サイタマ'], ['Genos', 'ジェノス'],
  ] },
  { id: 'mob', name: 'Mob Psycho 100', ja: 'モブサイコ100', category: 'shonen', chars: [
    ['Mob', 'モブ'], ['Reigen', '霊幻'],
  ] },
  { id: 'blackclover', name: 'Black Clover', ja: 'ブラッククローバー', category: 'shonen', chars: [
    ['Asta', 'アスタ'], ['Yuno', 'ユノ'],
  ] },
  { id: 'tokyorev', name: 'Tokyo Revengers', ja: '東京リベンジャーズ', category: 'shonen', chars: [
    ['Mikey', 'マイキー'], ['Takemichi', '武道'], ['Draken', 'ドラケン'],
  ] },
  { id: 'tokyoghoul', name: 'Tokyo Ghoul', ja: '東京喰種', category: 'shonen', chars: [
    ['Kaneki', '金木'],
  ] },
  { id: 'drstone', name: 'Dr. Stone', ja: 'Dr.STONE', category: 'shonen', chars: [
    ['Senku', '千空'],
  ] },
  { id: 'neverland', name: 'The Promised Neverland', ja: '約束のネバーランド', category: 'shonen', chars: [
    ['Emma', 'エマ'], ['Norman', 'ノーマン'],
  ] },

  // ---------- Classics ----------
  { id: 'sailormoon', name: 'Sailor Moon', ja: '美少女戦士セーラームーン', category: 'classics', chars: [
    ['Sailor Moon', 'セーラームーン'], ['Sailor Mars', 'セーラーマーズ'], ['Sailor Mercury', 'セーラーマーキュリー'],
    ['Sailor Jupiter', 'セーラージュピター'], ['Sailor Venus', 'セーラーヴィーナス'], ['Tuxedo Mask', 'タキシード仮面'],
    ['Luna', 'ルナ'], ['Chibiusa', 'ちびうさ'],
  ] },
  { id: 'bebop', name: 'Cowboy Bebop', ja: 'カウボーイビバップ', category: 'classics', chars: [
    ['Spike', 'スパイク'], ['Faye', 'フェイ'], ['Jet', 'ジェット'], ['Radical Ed', 'ラディカル・エド'],
    ['Ein', 'アイン'], ['Vicious', 'ビシャス'],
  ] },
  { id: 'eva', name: 'Neon Genesis Evangelion', ja: '新世紀エヴァンゲリオン', category: 'classics', chars: [
    ['Shinji', 'シンジ'], ['Asuka', 'アスカ'], ['Rei', 'レイ'], ['Misato', 'ミサト'],
    ['Kaworu', 'カヲル'], ['Gendo', 'ゲンドウ'],
  ] },
  { id: 'deathnote', name: 'Death Note', ja: 'DEATH NOTE', category: 'classics', chars: [
    ['Light', 'ライト'], ['L', 'L'], ['Ryuk', 'リューク'], ['Misa', 'ミサ'], ['Near', 'ニア'], ['Mello', 'メロ'],
  ] },
  { id: 'fma', name: 'Fullmetal Alchemist', ja: '鋼の錬金術師', category: 'classics', chars: [
    ['Edward', 'エドワード'], ['Alphonse', 'アルフォンス'], ['Mustang', 'マスタング'], ['Winry', 'ウィンリィ'],
    ['Scar', 'スカー'], ['Hughes', 'ヒューズ'], ['Riza', 'リザ'], ['Envy', 'エンヴィー'],
    ['Greed', 'グリード'], ['Armstrong', 'アームストロング'],
  ] },
  { id: 'ghibli', name: 'Studio Ghibli', ja: 'スタジオジブリ', category: 'classics', chars: [
    ['Totoro', 'トトロ'], ['Chihiro', '千尋'], ['No-Face', 'カオナシ'], ['Howl', 'ハウル'],
    ['Calcifer', 'カルシファー'], ['Kiki', 'キキ'], ['Ponyo', 'ポニョ'], ['San', 'サン'],
    ['Nausicaä', 'ナウシカ'], ['Haku', 'ハク'],
  ] },
  { id: 'pokemon', name: 'Pokémon', ja: 'ポケットモンスター', category: 'classics', chars: [
    ['Ash', 'サトシ'], ['Pikachu', 'ピカチュウ'], ['Misty', 'カスミ'], ['Brock', 'タケシ'],
    ['Team Rocket', 'ロケット団'], ['Meowth', 'ニャース'], ['Mewtwo', 'ミュウツー'], ['Jigglypuff', 'プリン'],
    ['Charizard', 'リザードン'], ['Snorlax', 'カビゴン'], ['Gengar', 'ゲンガー'], ['Eevee', 'イーブイ'],
    ['Psyduck', 'コダック'],
  ] },
  { id: 'inuyasha', name: 'Inuyasha', ja: '犬夜叉', category: 'classics', chars: [
    ['Inuyasha', '犬夜叉'], ['Kagome', 'かごめ'], ['Sesshomaru', '殺生丸'], ['Shippo', '七宝'],
    ['Miroku', '弥勒'], ['Sango', '珊瑚'],
  ] },
  { id: 'yyh', name: 'Yu Yu Hakusho', ja: '幽☆遊☆白書', category: 'classics', chars: [
    ['Yusuke', '幽助'], ['Kurama', '蔵馬'], ['Hiei', '飛影'], ['Kuwabara', '桑原'], ['Toguro', '戸愚呂'],
  ] },
  { id: 'yugioh', name: 'Yu-Gi-Oh!', ja: '遊☆戯☆王', category: 'classics', chars: [
    ['Yugi', '遊戯'], ['Kaiba', '海馬'], ['Joey', '城之内'], ['Exodia', 'エクゾディア'],
    ['Dark Magician', 'ブラック・マジシャン'],
  ] },
  { id: 'lupin', name: 'Lupin the Third', ja: 'ルパン三世', category: 'classics', chars: [
    ['Lupin', 'ルパン'], ['Jigen', '次元'], ['Goemon', '五ェ門'], ['Zenigata', '銭形'],
  ] },
  { id: 'doraemon', name: 'Doraemon', ja: 'ドラえもん', category: 'classics', chars: [
    ['Doraemon', 'ドラえもん'], ['Nobita', 'のび太'],
  ] },
  { id: 'astroboy', name: 'Astro Boy', ja: '鉄腕アトム', category: 'classics', chars: [
    ['Astro Boy', 'アトム'],
  ] },
  { id: 'gundam', name: 'Mobile Suit Gundam', ja: '機動戦士ガンダム', category: 'classics', chars: [
    ['Amuro', 'アムロ'], ['Char', 'シャア'],
  ] },
  { id: 'akira', name: 'Akira', ja: 'AKIRA', category: 'classics', chars: [
    ['Kaneda', '金田'], ['Tetsuo', '鉄雄'],
  ] },
  { id: 'ranma', name: 'Ranma ½', ja: 'らんま½', category: 'classics', chars: [
    ['Ranma', 'らんま'], ['Akane', 'あかね'],
  ] },
  { id: 'conan', name: 'Detective Conan', ja: '名探偵コナン', category: 'classics', chars: [
    ['Conan', 'コナン'], ['Kaito Kid', '怪盗キッド'],
  ] },
  { id: 'ccs', name: 'Cardcaptor Sakura', ja: 'カードキャプターさくら', category: 'classics', chars: [
    ['Kero', 'ケロちゃん'],
  ] },
  { id: 'trigun', name: 'Trigun', ja: 'トライガン', category: 'classics', chars: [
    ['Vash', 'ヴァッシュ'],
  ] },
  { id: 'kenshin', name: 'Rurouni Kenshin', ja: 'るろうに剣心', category: 'classics', chars: [
    ['Kenshin', '剣心'],
  ] },
  { id: 'geass', name: 'Code Geass', ja: 'コードギアス', category: 'classics', chars: [
    ['Lelouch', 'ルルーシュ'], ['C.C.', 'C.C.'], ['Suzaku', 'スザク'],
  ] },
  { id: 'hellsing', name: 'Hellsing', ja: 'HELLSING', category: 'classics', chars: [
    ['Alucard', 'アーカード'],
  ] },
  { id: 'fruitsbasket', name: 'Fruits Basket', ja: 'フルーツバスケット', category: 'classics', chars: [
    ['Tohru', '透'], ['Kyo', '夾'], ['Yuki', '由希'],
  ] },
  { id: 'haruhi', name: 'The Melancholy of Haruhi Suzumiya', ja: '涼宮ハルヒの憂鬱', category: 'classics', chars: [
    ['Haruhi', 'ハルヒ'],
  ] },
  { id: 'steinsgate', name: 'Steins;Gate', ja: 'シュタインズ・ゲート', category: 'classics', chars: [
    ['Okabe', '岡部'], ['Kurisu', '紅莉栖'],
  ] },
  { id: 'sao', name: 'Sword Art Online', ja: 'ソードアート・オンライン', category: 'classics', chars: [
    ['Kirito', 'キリト'], ['Asuna', 'アスナ'],
  ] },

  // ---------- Recent hits ----------
  { id: 'spyfamily', name: 'Spy x Family', ja: 'SPY×FAMILY', category: 'recent', chars: [
    ['Loid', 'ロイド'], ['Yor', 'ヨル'], ['Anya', 'アーニャ'], ['Bond', 'ボンド'],
    ['Damian', 'ダミアン'], ['Yuri', 'ユーリ'],
  ] },
  { id: 'csm', name: 'Chainsaw Man', ja: 'チェンソーマン', category: 'recent', chars: [
    ['Denji', 'デンジ'], ['Power', 'パワー'], ['Makima', 'マキマ'], ['Aki', 'アキ'],
    ['Pochita', 'ポチタ'], ['Reze', 'レゼ'], ['Kobeni', 'コベニ'],
  ] },
  { id: 'frieren', name: 'Frieren', ja: '葬送のフリーレン', category: 'recent', chars: [
    ['Frieren', 'フリーレン'], ['Fern', 'フェルン'], ['Stark', 'シュタルク'], ['Himmel', 'ヒンメル'],
    ['Heiter', 'ハイター'], ['Eisen', 'アイゼン'], ['Ubel', 'ユーベル'], ['Aura', 'アウラ'],
  ] },
  { id: 'sololeveling', name: 'Solo Leveling', ja: '俺だけレベルアップな件', category: 'recent', chars: [
    ['Jinwoo', '水篠旬'], ['Igris', 'イグリス'], ['Beru', 'ベル'],
  ] },
  { id: 'dandadan', name: 'Dandadan', ja: 'ダンダダン', category: 'recent', chars: [
    ['Okarun', 'オカルン'], ['Momo', 'モモ'], ['Turbo Granny', 'ターボババア'], ['Aira', 'アイラ'], ['Jiji', 'ジジ'],
  ] },
  { id: 'oshinoko', name: 'Oshi no Ko', ja: '【推しの子】', category: 'recent', chars: [
    ['Ai', 'アイ'], ['Aqua', 'アクア'], ['Ruby', 'ルビー'], ['Kana', 'かな'],
  ] },
  { id: 'bocchi', name: 'Bocchi the Rock!', ja: 'ぼっち・ざ・ろっく!', category: 'recent', chars: [
    ['Bocchi', 'ぼっち'], ['Nijika', '虹夏'], ['Ryo', 'リョウ'], ['Kita', '喜多'],
  ] },
  { id: 'dungeon', name: 'Delicious in Dungeon', ja: 'ダンジョン飯', category: 'recent', chars: [
    ['Laios', 'ライオス'], ['Marcille', 'マルシル'], ['Senshi', 'センシ'], ['Chilchuck', 'チルチャック'], ['Falin', 'ファリン'],
  ] },
  { id: 'apothecary', name: 'The Apothecary Diaries', ja: '薬屋のひとりごと', category: 'recent', chars: [
    ['Maomao', '猫猫'], ['Jinshi', '壬氏'],
  ] },
  { id: 'bluelock', name: 'Blue Lock', ja: 'ブルーロック', category: 'recent', chars: [
    ['Isagi', '潔'], ['Bachira', '蜂楽'], ['Nagi', '凪'],
  ] },
  { id: 'kaiju8', name: 'Kaiju No. 8', ja: '怪獣8号', category: 'recent', chars: [
    ['Kafka', 'カフカ'],
  ] },
  { id: 'sakamoto', name: 'Sakamoto Days', ja: 'SAKAMOTO DAYS', category: 'recent', chars: [
    ['Sakamoto', '坂本'], ['Shin', 'シン'],
  ] },
  { id: 'vinland', name: 'Vinland Saga', ja: 'ヴィンランド・サガ', category: 'recent', chars: [
    ['Thorfinn', 'トルフィン'], ['Askeladd', 'アシェラッド'],
  ] },
  { id: 'hellsparadise', name: "Hell's Paradise", ja: '地獄楽', category: 'recent', chars: [
    ['Gabimaru', '画眉丸'],
  ] },
  { id: 'rezero', name: 'Re:Zero', ja: 'Re:ゼロから始める異世界生活', category: 'recent', chars: [
    ['Subaru', 'スバル'], ['Emilia', 'エミリア'], ['Rem', 'レム'], ['Ram', 'ラム'],
  ] },
  { id: 'konosuba', name: 'KonoSuba', ja: 'この素晴らしい世界に祝福を!', category: 'recent', chars: [
    ['Kazuma', 'カズマ'], ['Megumin', 'めぐみん'], ['Darkness', 'ダクネス'],
  ] },
  { id: 'kaguya', name: 'Kaguya-sama: Love Is War', ja: 'かぐや様は告らせたい', category: 'recent', chars: [
    ['Kaguya', 'かぐや'], ['Chika', '千花'], ['Shirogane', '白銀'],
  ] },
];
