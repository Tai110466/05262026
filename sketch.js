let rainData = null;
let isLoading = true;
let errorMsg = null;

let mappa;
let myMap;
let canvas;
let isRaining = false;
let rainDrops = [];

const options = {
  lat: 25.0330,  // 以台北市為中心緯度
  lng: 121.5654, // 以台北市為中心經度
  zoom: 12,      // 地圖縮放層級
  style: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
};

function setup() {
  // 設定全螢幕畫布
  canvas = createCanvas(windowWidth, windowHeight);
  
  // 初始化 Mappa 與 Leaflet 地圖，並將畫布疊加於地圖上方
  mappa = new Mappa('Leaflet');
  myMap = mappa.tileMap(options);
  myMap.overlay(canvas);

  // 初始化雨滴物件，用於天氣動畫效果
  for(let i=0; i<30; i++) {
    rainDrops.push({x: random(-30, 30), y: random(-20, 20), speed: random(2, 6)});
  }

  // 台北市 Opendata API 網址
  const targetApiUrl = 'https://wic.gov.taipei/OpenData/API/Rain/Get?stationNo=&loginId=open_rain&dataKey=85452C1D';
  
  // 更換 CORS 代理伺服器，使用透明代理 corsproxy.io
  const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(targetApiUrl);
  
  // 台北市主要測站經緯度座標對照表 (用於地圖定位)
  const stationCoords = {
    "湖田國小": { lat: 25.1528, lon: 121.5323 },
    "大屯國小": { lat: 25.1741, lon: 121.4925 },
    "桃源國中": { lat: 25.1397, lon: 121.4914 },
    "北投國小": { lat: 25.1321, lon: 121.5005 },
    "陽明高中": { lat: 25.0945, lon: 121.5148 },
    "太平國小": { lat: 25.0610, lon: 121.5111 },
    "民生國中": { lat: 25.0602, lon: 121.5606 },
    "中正國中": { lat: 25.0336, lon: 121.5201 },
    "三興國小": { lat: 25.0303, lon: 121.5583 },
    "格致國中": { lat: 25.1362, lon: 121.5387 },
    "平等國小": { lat: 25.1278, lon: 121.5714 },
    "至善國中": { lat: 25.1014, lon: 121.5489 },
    "碧湖國小": { lat: 25.0811, lon: 121.5878 },
    "東湖國小": { lat: 25.0689, lon: 121.6169 },
    "瑠公國中": { lat: 25.0372, lon: 121.5847 },
    "舊莊國小": { lat: 25.0402, lon: 121.6186 },
    "博嘉國小": { lat: 25.0000, lon: 121.5886 },
    "北政國中": { lat: 24.9861, lon: 121.5786 },
    "長安國小": { lat: 25.0489, lon: 121.5283 },
    "萬華國中": { lat: 25.0278, lon: 121.4986 },
    "台灣大學(新)": { lat: 25.0175, lon: 121.5397 },
    "雙園": { lat: 25.0232, lon: 121.4925 },
    "中洲": { lat: 25.1235, lon: 121.4608 }
  };

  // 僅發送台北市雨量 API 請求
  fetch(proxyUrl)
    .then(res => {
      if (!res.ok) throw new Error('台北市雨量 API 回應錯誤');
      return res.json();
    })
    .then(taipeiRes => {
      // 解析台北市雨量資料
      let tData = taipeiRes; // corsproxy.io 會直接回傳真實的 JSON 資料，不需再透過 .contents 解開
    let dataList = [];
    if (Array.isArray(tData)) dataList = tData;
    else if (tData.data && Array.isArray(tData.data)) dataList = tData.data;
    else if (tData.list && Array.isArray(tData.list)) dataList = tData.list;

    // 將內建的經緯度合併至雨量資料中 (過濾出成功配對的測站)
    rainData = [];
    for (let item of dataList) {
      let stName = item.stationName ? item.stationName.replace(/臺/g, '台') : '';
      let match = stationCoords[stName];
      if (match) {
        item.lat = match.lat;
        item.lon = match.lon;
        item.county = '臺北市'; 
        rainData.push(item);
      }
    }

    if (rainData.length === 0) {
      throw new Error('無法將雨量資料與內建座標配對');
    }

    // 判斷是否下雨 (若任一站點雨量大於0則顯示下雨特效)
    isRaining = rainData.some(item => (parseFloat(item.rain) || 0) > 0);

    isLoading = false;
  })
  .catch(error => {
    console.error('獲取資料失敗:', error);
    errorMsg = error.message;
    isLoading = false;
  });
}

function draw() {
  // 使用 clear() 讓畫布背景透明，以顯示底層的 Mappa 地圖
  clear();
  
  if (isLoading) {
    // 載入中的提示畫面
    fill(255);
    textSize(24);
    textAlign(CENTER, CENTER);
    text('正在載入台北市及時雨量資料...', width / 2, height / 2);
  } else if (errorMsg) {
    // 發生錯誤的提示畫面
    fill(255, 100, 100);
    textSize(24);
    textAlign(CENTER, CENTER);
    text('載入失敗: ' + errorMsg, width / 2, height / 2);
  } else if (rainData) {
    // 資料載入成功，準備繪製
    textAlign(LEFT, TOP);
    
    let hoveredMapStation = null;
    let hoveredPanelStation = null;
    let panelWidth = 260;

    // 1. 判斷游標是否懸停於左側面板的測站列表
    if (mouseX > 0 && mouseX < panelWidth) {
      for (let i = 0; i < rainData.length; i++) {
        let ty = 60 + i * 25;
        if (mouseY >= ty && mouseY < ty + 25) {
          hoveredPanelStation = rainData[i];
          break;
        }
      }
    }

    // 2. 迴圈印出每個測站的資料在地圖上
    for (let i = 0; i < rainData.length; i++) {
      let item = rainData[i];
      
      // 透過 Mappa 將經緯度轉換為畫布上的 (x, y) 像素座標
      const pos = myMap.latLngToPixel(item.lat, item.lon);
      
      let d = dist(mouseX, mouseY, pos.x, pos.y);
      let isHoveredMap = d < 15;
      let isHoveredPanel = (hoveredPanelStation === item);
      let rainVal = parseFloat(item.rain) || 0;
      
      noStroke();
      if (isHoveredMap || isHoveredPanel) {
        fill(255, 255, 0, 255); // 懸停或列表對應時顯示醒目的黃色
        stroke(255);
        strokeWeight(2);
        circle(pos.x, pos.y, 30); // 懸停時顯著放大
        if (isHoveredMap) hoveredMapStation = { data: item, pos: pos }; 
      } else {
        if (rainVal > 10) {
          fill(255, 50, 50, 220); // 雨量大於10mm顯示紅色
        } else {
          fill(255, 255, 255, 220); // 其餘顯示白色
        }
        stroke(0, 100);
        strokeWeight(1);
        circle(pos.x, pos.y, 15);
      }
    }

    // 3. 繪製左側雨量列表面板
    fill(0, 180);
    noStroke();
    rect(0, 0, panelWidth, height);
    
    fill(100, 200, 255);
    textSize(22);
    text('台北市即時雨量列表', 15, 20);
    
    for (let i = 0; i < rainData.length; i++) {
      let item = rainData[i];
      let ty = 60 + i * 25;
      if (hoveredPanelStation === item) {
        fill(255, 255, 0);
        textSize(16);
      } else {
        fill(255);
        textSize(15);
      }
      let rainVal = parseFloat(item.rain) || 0;
      text(`${item.stationName}: ${rainVal} mm`, 15, ty);
    }

    // 4. 繪製降雨量顏色標示面板 (Legend)
    let legendX = panelWidth + 20;
    let legendY = 20;
    fill(0, 180);
    noStroke();
    rect(legendX, legendY, 180, 85, 8);
    
    fill(100, 200, 255);
    textSize(16);
    text('降雨量顏色區分', legendX + 15, legendY + 10);
    
    // 紅色 > 10mm
    fill(255, 50, 50, 220);
    stroke(0, 100);
    strokeWeight(1);
    circle(legendX + 25, legendY + 45, 15);
    fill(255);
    noStroke();
    text('> 10 mm', legendX + 45, legendY + 38);
    
    // 白色 <= 10mm
    fill(255, 255, 255, 220);
    stroke(0, 100);
    strokeWeight(1);
    circle(legendX + 25, legendY + 70, 15);
    fill(255);
    noStroke();
    text('<= 10 mm', legendX + 45, legendY + 63);

    // 5. 繪製右上角天氣動態效果 (太陽 或 雲雨)
    push();
    translate(width - 80, 80);
    if (isRaining) {
      // 下雨雲朵效果
      noStroke();
      fill(180);
      ellipse(0, -10, 60, 40);
      ellipse(-20, 0, 40, 30);
      ellipse(20, 0, 40, 30);
      stroke(100, 150, 255);
      strokeWeight(2);
      for(let drop of rainDrops) {
        line(drop.x, drop.y, drop.x - drop.speed*0.3, drop.y + drop.speed);
        drop.y += drop.speed;
        drop.x -= drop.speed * 0.3;
        if(drop.y > 40) {
          drop.y = random(-10, 10);
          drop.x = random(-30, 30);
        }
      }
    } else {
      // 出太陽效果
      noStroke();
      fill(255, 204, 0);
      circle(0, 0, 40);
      stroke(255, 204, 0);
      strokeWeight(3);
      for(let i=0; i<8; i++) {
        let angle = frameCount * 0.02 + i * PI / 4;
        line(cos(angle)*25, sin(angle)*25, cos(angle)*40, sin(angle)*40);
      }
    }
    pop();

    // 6. 若有滑鼠懸停於地圖站點，繪製資訊視窗 (確保蓋在所有元素上方)
    if (hoveredMapStation) {
      let info = hoveredMapStation.data;
      let px = hoveredMapStation.pos.x;
      let py = hoveredMapStation.pos.y;
      
      // 準備要顯示的文字內容
      let infoText = Object.keys(info)
        .filter(k => k !== 'lat' && k !== 'lon') // 不顯示經緯度欄位
        .map(k => `${k}: ${info[k]}`)
        .join('\n');
        
      textSize(14);
      let lines = infoText.split('\n');
      let maxW = 0;
      for (let l of lines) {
        let w = textWidth(l);
        if (w > maxW) maxW = w;
      }
      
      let boxW = maxW + 20;
      let boxH = lines.length * 18 + 20;
      
      // 防止資訊框超出畫面邊界
      let tooltipX = px + 20;
      let tooltipY = py - boxH / 2;
      if (tooltipX + boxW > width) tooltipX = px - boxW - 20;
      if (tooltipY < 0) tooltipY = 10;
      if (tooltipY + boxH > height) tooltipY = height - boxH - 10<
      // 繪製資訊框背景
      fill(0, 200);
      stroke(255);
      strokeWeight(1);
      rect(tooltipX, tooltipY, boxW, boxH, 5);
      
      // 繪製資訊框文字
      noStroke();
      fill(255);
      textAlign(LEFT, TOP);
      text(infoText, tooltipX + 10, tooltipY + 10);
    }
  }
}

// 當瀏覽器視窗大小改變時，自動重新調整畫布大小 (維持全螢幕)
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}