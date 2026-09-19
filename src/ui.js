import {createShellModel} from '../shared/packages/ui-shell/src/index.js';

export const cattleTheme=Object.freeze({
  direction:'rural-livestock',
  primary:'#315A3E',
  primaryHover:'#274A33',
  leather:'#A86F45',
  veterinary:'#36736D',
  cream:'#F5EFE3',
  background:'#F4F7F4',
  surface:'#FFFFFF',
  border:'#DCE4DC',
  text:'#17201B',
  muted:'#6B786F',
  success:'#447A4F',
  warning:'#C58A2C',
  danger:'#9C2F2F'
});

const navigation=Object.freeze([
  {id:'overview',label:'Dashboard',icon:'layout-dashboard'},
  {id:'lots',label:'Lotes',icon:'layers-3'},
  {id:'animals',label:'Animais',icon:'tag'},
  {id:'weights',label:'Pesagens',icon:'scale'},
  {id:'sanitary',label:'Sanidade',icon:'shield-plus'},
  {id:'reproduction',label:'Reprodução',icon:'heart'},
  {id:'trades',label:'Compras e Vendas',icon:'badge-dollar-sign'},
  {id:'finance',label:'Resultado por Lote',icon:'wallet-cards'},
  {id:'reports',label:'Relatórios Zootécnicos',icon:'chart-no-axes-combined'},
  {id:'iot',label:'Dispositivos e IoT',icon:'radio-tower'},
  {id:'settings',label:'Configurações',icon:'settings'}
]);

export function createCattleShellModel({capabilities=[]}={}){
  return createShellModel({
    brand:{
      name:'ArtiSys Pecuária',
      productName:'Gestão Pecuária',
      theme:cattleTheme,
      visualDirection:'clean rural premium with livestock and veterinary cues'
    },
    capabilities,
    navigation
  });
}
