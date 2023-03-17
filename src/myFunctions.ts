const cores = [
    //primárias
    {cor:'azul',r:0,g:0,b:255},
    {cor:'vermelho',r:255,g:0,b:0},
    {cor:'verde',r:0,g:255,b:0},
    //cores secundárias
    {cor:'amarelo',r:255,g:255,b:0},
    {cor:'roxo',r:128,g:0,b:128},
    {cor:'marrom',r:165,g:42,b:42}, 
    {cor:'marrom',r:128,g:0,b:0}, //acrescimo
    {cor:'laranja',r:255,g:165,b:0}, 
    //Cores Claras
    {cor:'azulClaro',r:173,g:216,b:230},
    {cor:'verdeClaro',r:144,g:238,b:144},
    {cor:'laranjaClaro',r:254,g:161,b:25},
    {cor:'vermelhoClaro',r:252,g:196,b:88},
    {cor:'roxoClaro',r:246,g:186,b:202},
    {cor:'marromClaro',r:245,g:198,b:93},
    //Cores escuras
    {cor:'azulEscuro',r:0,g:0,b:139},
    {cor:'verdeEscuro',r:0,g:100,b:0}, 
    {cor:'amareloEscuro',r:253,g:195,b:45},
    {cor:'laranjaEscuro',r:188,g:74,b:22},
    {cor:'vermelhoEscuro',r:121,g:35,b:47},
    {cor:'vermelhoEscuro',r:139,g:0,b:0}, //acrescimo
    {cor:'roxoEscuro',r:83,g:40,b:78},
    {cor:'marromEscuro',r:103,g:57,b:24},
    //cores especiais
    {cor:'ouro',r:255,g:215,b:0},
    {cor:'prata',r:192,g:192,b:192},
    {cor:'cinzaEscuro',r:169,g:169,b:169},
    {cor:'branco',r:255,g:255,b:255},
    {cor:'preto',r:0,g:0,b:0}
 
    //cores adicionais
 
 ];
 
 
 function distance(cor1, cor2){
    return Math.sqrt((cor1.r-cor2.r)*(cor1.r-cor2.r)+(cor1.g-cor2.g)*(cor1.g-cor2.g)+(cor1.b-cor2.b)*(cor1.b-cor2.b));
 }
 
export function findcolor(cor){
    let perto = cores[0]
    let distancia = distance(perto, cor)
    for(let i = 1; i < cores.length; i++){
       let distanciaAt = distance(cores[i], cor)
       if(distanciaAt < distancia){
          perto = cores[i]
          distancia = distanciaAt
       }
    }
    console.log(perto, distancia)
    return perto;
 }
 
 export function getImage(cor){
    return ("img/" + cor.cor + ".png")
 }