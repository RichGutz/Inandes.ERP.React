// src/constants/sbsBancos.ts

export interface SbsInstitucionFinanciera {
  id: number;
  tipoEntidad: 'BANCO' | 'FINANCIERA' | 'CAJA_MUNICIPAL' | 'CAJA_RURAL';
  razonSocialSbs: string;
  nombreComercial: string; // Nickname oficial SBS / ERP
  codigoCci: string;
  canalBcp: 'ABONO_DIRECTO_BCP' | 'INTERBANCARIO_CCI';
  tipoCuentaDefault: 'CCT' | 'SCA' | 'CND';
}

export const SBS_INSTITUCIONES_FINANCIERAS: SbsInstitucionFinanciera[] = [
  // ==========================================
  // 1. EMPRESAS BANCARIAS (20)
  // ==========================================
  {
    id: 1,
    tipoEntidad: 'BANCO',
    razonSocialSbs: "BANCO DE CREDITO DEL PERU",
    nombreComercial: "BCP",
    codigoCci: "002",
    canalBcp: "ABONO_DIRECTO_BCP",
    tipoCuentaDefault: "CCT"
  },
  {
    id: 2,
    tipoEntidad: 'BANCO',
    razonSocialSbs: "BANCO BBVA PERU",
    nombreComercial: "BBVA",
    codigoCci: "011",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 3,
    tipoEntidad: 'BANCO',
    razonSocialSbs: "BANCO INTERNACIONAL DEL PERU S.A.A.",
    nombreComercial: "INTERBANK",
    codigoCci: "003",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 4,
    tipoEntidad: 'BANCO',
    razonSocialSbs: "SCOTIABANK PERU S.A.A.",
    nombreComercial: "SCOTIABANK",
    codigoCci: "009",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 5,
    tipoEntidad: 'BANCO',
    razonSocialSbs: "BANCO INTERAMERICANO DE FINANZAS",
    nombreComercial: "BANBIF",
    codigoCci: "038",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 6,
    tipoEntidad: 'BANCO',
    razonSocialSbs: "BANCO PICHINCHA",
    nombreComercial: "BANCO PICHINCHA",
    codigoCci: "018",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 7,
    tipoEntidad: 'BANCO',
    razonSocialSbs: "BANCO GNB PERU S.A.",
    nombreComercial: "BANCO GNB",
    codigoCci: "053",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 8,
    tipoEntidad: 'BANCO',
    razonSocialSbs: "BANCO DE COMERCIO",
    nombreComercial: "BANCOM",
    codigoCci: "049",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 9,
    tipoEntidad: 'BANCO',
    razonSocialSbs: "BANCO FALABELLA PERU S.A.",
    nombreComercial: "BANCO FALABELLA",
    codigoCci: "056",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 10,
    tipoEntidad: 'BANCO',
    razonSocialSbs: "BANCO RIPLEY PERU S.A.",
    nombreComercial: "BANCO RIPLEY",
    codigoCci: "054",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 11,
    tipoEntidad: 'BANCO',
    razonSocialSbs: "BANCO SANTANDER PERU S.A.",
    nombreComercial: "BANCO SANTANDER",
    codigoCci: "055",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 12,
    tipoEntidad: 'BANCO',
    razonSocialSbs: "ALFIN BANCO S.A.",
    nombreComercial: "ALFIN BANCO",
    codigoCci: "045",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 13,
    tipoEntidad: 'BANCO',
    razonSocialSbs: "MIBANCO, BANCO DE LA MICROEMPRESA S.A.",
    nombreComercial: "MIBANCO",
    codigoCci: "048",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 14,
    tipoEntidad: 'BANCO',
    razonSocialSbs: "BANCO BCI PERU",
    nombreComercial: "BANCO BCI",
    codigoCci: "062",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 15,
    tipoEntidad: 'BANCO',
    razonSocialSbs: "BANCO EFECTIVA S.A.",
    nombreComercial: "BANCO EFECTIVA",
    codigoCci: "065",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 16,
    tipoEntidad: 'BANCO',
    razonSocialSbs: "COMPARTAMOS BANCO S.A.",
    nombreComercial: "COMPARTAMOS BANCO",
    codigoCci: "063",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 17,
    tipoEntidad: 'BANCO',
    razonSocialSbs: "CITIBANK DEL PERU S.A.",
    nombreComercial: "CITIBANK",
    codigoCci: "007",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 18,
    tipoEntidad: 'BANCO',
    razonSocialSbs: "ICBC PERU BANK",
    nombreComercial: "ICBC PERU",
    codigoCci: "060",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 19,
    tipoEntidad: 'BANCO',
    razonSocialSbs: "BANK OF CHINA (PERU) S.A.",
    nombreComercial: "BANK OF CHINA",
    codigoCci: "061",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 20,
    tipoEntidad: 'BANCO',
    razonSocialSbs: "SANTANDER CONSUMER BANK",
    nombreComercial: "SANTANDER CONSUMER",
    codigoCci: "064",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },

  // ==========================================
  // 2. CAJAS MUNICIPALES DE AHORRO Y CRÉDITO - CMAC (11)
  // ==========================================
  {
    id: 21,
    tipoEntidad: 'CAJA_MUNICIPAL',
    razonSocialSbs: "CMAC AREQUIPA",
    nombreComercial: "CAJA AREQUIPA",
    codigoCci: "801",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 22,
    tipoEntidad: 'CAJA_MUNICIPAL',
    razonSocialSbs: "CMAC CUSCO S.A.",
    nombreComercial: "CAJA CUSCO",
    codigoCci: "806",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 23,
    tipoEntidad: 'CAJA_MUNICIPAL',
    razonSocialSbs: "CMAC DEL SANTA",
    nombreComercial: "CAJA DEL SANTA",
    codigoCci: "812",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 24,
    tipoEntidad: 'CAJA_MUNICIPAL',
    razonSocialSbs: "CMAC HUANCAYO",
    nombreComercial: "CAJA HUANCAYO",
    codigoCci: "805",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 25,
    tipoEntidad: 'CAJA_MUNICIPAL',
    razonSocialSbs: "CMAC ICA",
    nombreComercial: "CAJA ICA",
    codigoCci: "804",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 26,
    tipoEntidad: 'CAJA_MUNICIPAL',
    razonSocialSbs: "CMAC MAYNAS",
    nombreComercial: "CAJA MAYNAS",
    codigoCci: "810",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 27,
    tipoEntidad: 'CAJA_MUNICIPAL',
    razonSocialSbs: "CMAC PAITA",
    nombreComercial: "CAJA PAITA",
    codigoCci: "811",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 28,
    tipoEntidad: 'CAJA_MUNICIPAL',
    razonSocialSbs: "CMAC PIURA",
    nombreComercial: "CAJA PIURA",
    codigoCci: "808",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 29,
    tipoEntidad: 'CAJA_MUNICIPAL',
    razonSocialSbs: "CMAC TACNA",
    nombreComercial: "CAJA TACNA",
    codigoCci: "809",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 30,
    tipoEntidad: 'CAJA_MUNICIPAL',
    razonSocialSbs: "CMAC TRUJILLO",
    nombreComercial: "CAJA TRUJILLO",
    codigoCci: "807",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 31,
    tipoEntidad: 'CAJA_MUNICIPAL',
    razonSocialSbs: "CAJA METROPOLITANA DE LIMA",
    nombreComercial: "CAJA METROPOLITANA",
    codigoCci: "803",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },

  // ==========================================
  // 3. CAJAS RURALES DE AHORRO Y CRÉDITO - CRAC (5)
  // ==========================================
  {
    id: 32,
    tipoEntidad: 'CAJA_RURAL',
    razonSocialSbs: "CRAC LOS ANDES",
    nombreComercial: "CAJA LOS ANDES",
    codigoCci: "815",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 33,
    tipoEntidad: 'CAJA_RURAL',
    razonSocialSbs: "CRAC DEL CENTRO",
    nombreComercial: "CAJA DEL CENTRO",
    codigoCci: "816",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 34,
    tipoEntidad: 'CAJA_RURAL',
    razonSocialSbs: "CRAC PRYMERA",
    nombreComercial: "CAJA PRYMERA",
    codigoCci: "818",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 35,
    tipoEntidad: 'CAJA_RURAL',
    razonSocialSbs: "CRAC INCASUR",
    nombreComercial: "CAJA INCASUR",
    codigoCci: "819",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 36,
    tipoEntidad: 'CAJA_RURAL',
    razonSocialSbs: "CRAC CENCOSUD SCOTIA",
    nombreComercial: "CAJA CENCOSUD SCOTIA",
    codigoCci: "820",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },

  // ==========================================
  // 4. EMPRESAS FINANCIERAS (7)
  // ==========================================
  {
    id: 37,
    tipoEntidad: 'FINANCIERA',
    razonSocialSbs: "FINANCIERA CONFIANZA S.A.A.",
    nombreComercial: "FINANCIERA CONFIANZA",
    codigoCci: "301",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 38,
    tipoEntidad: 'FINANCIERA',
    razonSocialSbs: "FINANCIERA OH! S.A.",
    nombreComercial: "FINANCIERA OH!",
    codigoCci: "302",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 39,
    tipoEntidad: 'FINANCIERA',
    razonSocialSbs: "FINANCIERA QAPAQ S.A.",
    nombreComercial: "FINANCIERA QAPAQ",
    codigoCci: "303",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 40,
    tipoEntidad: 'FINANCIERA',
    razonSocialSbs: "FINANCIERA PROEMPRESA S.A.",
    nombreComercial: "FINANCIERA PROEMPRESA",
    codigoCci: "304",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 41,
    tipoEntidad: 'FINANCIERA',
    razonSocialSbs: "FINANCIERA CREDINKA S.A.",
    nombreComercial: "FINANCIERA CREDINKA",
    codigoCci: "305",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 42,
    tipoEntidad: 'FINANCIERA',
    razonSocialSbs: "MITSUI AUTO FINANCE PERU S.A.",
    nombreComercial: "FINANCIERA MAF",
    codigoCci: "306",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  },
  {
    id: 43,
    tipoEntidad: 'FINANCIERA',
    razonSocialSbs: "FINANCIERA SANTANDER CONSUMER S.A.",
    nombreComercial: "FINANCIERA SANTANDER",
    codigoCci: "307",
    canalBcp: "INTERBANCARIO_CCI",
    tipoCuentaDefault: "CND"
  }
];

// Lista de nombres comerciales cortos (Nicknames oficiales) para los selectores de la UI
export const SBS_BANCOS_NOMBRES: string[] = SBS_INSTITUCIONES_FINANCIERAS.map(e => e.nombreComercial);
