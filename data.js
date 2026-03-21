/**
 * Données complètes du Hangeul avec prononciations françaises.
 * Exporté en variable globale HANGUL_DATA.
 */
const HANGUL_DATA = {
  consonnes: [
    { char: "ㄱ", pronFR: "g/k", category: "consonne" },
    { char: "ㄴ", pronFR: "n", category: "consonne" },
    { char: "ㄷ", pronFR: "d/t", category: "consonne" },
    { char: "ㄹ", pronFR: "r/l", category: "consonne" },
    { char: "ㅁ", pronFR: "m", category: "consonne" },
    { char: "ㅂ", pronFR: "b/p", category: "consonne" },
    { char: "ㅅ", pronFR: "s", category: "consonne" },
    { char: "ㅇ", pronFR: "ng/muet", category: "consonne" },
    { char: "ㅈ", pronFR: "j/tch", category: "consonne" },
    { char: "ㅊ", pronFR: "tch", category: "consonne" },
    { char: "ㅋ", pronFR: "k", category: "consonne" },
    { char: "ㅌ", pronFR: "t", category: "consonne" },
    { char: "ㅍ", pronFR: "p", category: "consonne" },
    { char: "ㅎ", pronFR: "h", category: "consonne" }
  ],

  voyelles: [
    { char: "ㅏ", pronFR: "a", category: "voyelle" },
    { char: "ㅑ", pronFR: "ya", category: "voyelle" },
    { char: "ㅓ", pronFR: "eo/o ouvert", category: "voyelle" },
    { char: "ㅕ", pronFR: "yeo", category: "voyelle" },
    { char: "ㅗ", pronFR: "o", category: "voyelle" },
    { char: "ㅛ", pronFR: "yo", category: "voyelle" },
    { char: "ㅜ", pronFR: "ou", category: "voyelle" },
    { char: "ㅠ", pronFR: "you", category: "voyelle" },
    { char: "ㅡ", pronFR: "eu", category: "voyelle" },
    { char: "ㅣ", pronFR: "i", category: "voyelle" }
  ],

  consonnesDoubles: [
    { char: "ㄲ", pronFR: "kk", category: "consonne double" },
    { char: "ㄸ", pronFR: "tt", category: "consonne double" },
    { char: "ㅃ", pronFR: "pp", category: "consonne double" },
    { char: "ㅆ", pronFR: "ss", category: "consonne double" },
    { char: "ㅉ", pronFR: "tch fort", category: "consonne double" }
  ],

  voyellesComposees: [
    { char: "ㅐ", pronFR: "e/ai", category: "voyelle composee" },
    { char: "ㅒ", pronFR: "ye", category: "voyelle composee" },
    { char: "ㅔ", pronFR: "e", category: "voyelle composee" },
    { char: "ㅖ", pronFR: "ye", category: "voyelle composee" },
    { char: "ㅘ", pronFR: "wa", category: "voyelle composee" },
    { char: "ㅙ", pronFR: "we", category: "voyelle composee" },
    { char: "ㅚ", pronFR: "we/oe", category: "voyelle composee" },
    { char: "ㅝ", pronFR: "wo", category: "voyelle composee" },
    { char: "ㅞ", pronFR: "we", category: "voyelle composee" },
    { char: "ㅟ", pronFR: "wi", category: "voyelle composee" },
    { char: "ㅢ", pronFR: "ui", category: "voyelle composee" }
  ],

  syllabes: [
    // Consonnes + ㅏ (a)
    { char: "가", pronFR: "ga", category: "syllabe" },
    { char: "나", pronFR: "na", category: "syllabe" },
    { char: "다", pronFR: "da", category: "syllabe" },
    { char: "라", pronFR: "ra/la", category: "syllabe" },
    { char: "마", pronFR: "ma", category: "syllabe" },
    { char: "바", pronFR: "ba", category: "syllabe" },
    { char: "사", pronFR: "sa", category: "syllabe" },
    { char: "아", pronFR: "a", category: "syllabe" },
    { char: "자", pronFR: "ja/tcha", category: "syllabe" },
    { char: "차", pronFR: "tcha", category: "syllabe" },
    { char: "카", pronFR: "ka", category: "syllabe" },
    { char: "타", pronFR: "ta", category: "syllabe" },
    { char: "파", pronFR: "pa", category: "syllabe" },
    { char: "하", pronFR: "ha", category: "syllabe" },

    // Consonnes + ㅓ (eo)
    { char: "거", pronFR: "geo", category: "syllabe" },
    { char: "너", pronFR: "neo", category: "syllabe" },
    { char: "더", pronFR: "deo", category: "syllabe" },
    { char: "러", pronFR: "reo/leo", category: "syllabe" },
    { char: "머", pronFR: "meo", category: "syllabe" },
    { char: "버", pronFR: "beo", category: "syllabe" },
    { char: "서", pronFR: "seo", category: "syllabe" },
    { char: "어", pronFR: "eo", category: "syllabe" },

    // Consonnes + ㅗ (o)
    { char: "고", pronFR: "go", category: "syllabe" },
    { char: "노", pronFR: "no", category: "syllabe" },
    { char: "도", pronFR: "do", category: "syllabe" },
    { char: "로", pronFR: "ro/lo", category: "syllabe" },
    { char: "모", pronFR: "mo", category: "syllabe" },
    { char: "보", pronFR: "bo", category: "syllabe" },
    { char: "소", pronFR: "so", category: "syllabe" },
    { char: "오", pronFR: "o", category: "syllabe" },

    // Consonnes + ㅜ (ou)
    { char: "구", pronFR: "gou", category: "syllabe" },
    { char: "누", pronFR: "nou", category: "syllabe" },
    { char: "두", pronFR: "dou", category: "syllabe" },
    { char: "루", pronFR: "rou/lou", category: "syllabe" },
    { char: "무", pronFR: "mou", category: "syllabe" },
    { char: "부", pronFR: "bou", category: "syllabe" },
    { char: "수", pronFR: "sou", category: "syllabe" },
    { char: "우", pronFR: "ou", category: "syllabe" },

    // Consonnes + ㅡ (eu)
    { char: "그", pronFR: "geu", category: "syllabe" },
    { char: "느", pronFR: "neu", category: "syllabe" },
    { char: "드", pronFR: "deu", category: "syllabe" },
    { char: "르", pronFR: "reu/leu", category: "syllabe" },
    { char: "스", pronFR: "seu", category: "syllabe" },

    // Consonnes + ㅣ (i)
    { char: "기", pronFR: "gui", category: "syllabe" },
    { char: "니", pronFR: "ni", category: "syllabe" },
    { char: "디", pronFR: "di", category: "syllabe" },
    { char: "리", pronFR: "ri/li", category: "syllabe" },
    { char: "미", pronFR: "mi", category: "syllabe" },
    { char: "비", pronFR: "bi", category: "syllabe" },
    { char: "시", pronFR: "shi/si", category: "syllabe" },
    { char: "이", pronFR: "i", category: "syllabe" },
    { char: "지", pronFR: "ji/tchi", category: "syllabe" },
    { char: "치", pronFR: "tchi", category: "syllabe" },
    { char: "히", pronFR: "hi", category: "syllabe" },

    // Syllabes courantes supplémentaires
    { char: "한", pronFR: "han", category: "syllabe" },
    { char: "글", pronFR: "geul", category: "syllabe" },
    { char: "감", pronFR: "gam", category: "syllabe" },
    { char: "말", pronFR: "mal", category: "syllabe" },
    { char: "밥", pronFR: "bap", category: "syllabe" },
    { char: "물", pronFR: "moul", category: "syllabe" },
    { char: "집", pronFR: "jip/tchip", category: "syllabe" },
    { char: "학", pronFR: "hak", category: "syllabe" },
    { char: "생", pronFR: "seng", category: "syllabe" },
    { char: "김", pronFR: "kim", category: "syllabe" },
    { char: "선", pronFR: "seon", category: "syllabe" },
    { char: "민", pronFR: "min", category: "syllabe" },
    { char: "국", pronFR: "gouk", category: "syllabe" }
  ]
};
