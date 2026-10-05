import type { Locale } from "@/lib/i18n"

export type ChangelogKind = "added" | "fixed" | "improved"

export type ChangelogEntry = {
  id: string
  date: string
  kind: ChangelogKind
  en: string
  tc: string
  sc: string
}

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    id: "2026-10-05-only-beside",
    date: "2026-10-05",
    kind: "improved",
    en: "While Only is on, choosing another layer turns Only off and leaves both layers on. Choosing the layer already on turns it off.",
    tc: "只看開啟時，再選另一層，只看會關閉，地圖留下原來那層和剛選的一層。再按已選的那層，就會把它關掉。",
    sc: "只看开启时，再选另一层，只看会关闭，地图留下原来那层和刚选的一层。再按已选的那层，就会把它关掉。",
  },
  {
    id: "2026-10-05-overview-follow",
    date: "2026-10-05",
    kind: "fixed",
    en: "With Only on, moving the city view loads the pins for the place you are looking at. New Lantao Bus shows from the harbour when it is the only layer.",
    tc: "開啟只看後，在城市比例移動地圖，會載入你看着的位置的標記。只看嶼巴時，從海港也能找到車站。",
    sc: "开启只看后，在城市比例移动地图，会载入你看着的位置的标记。只看屿巴时，从海港也能找到车站。",
  },
  {
    id: "2026-10-05-pin-reach",
    date: "2026-10-05",
    kind: "fixed",
    en: "Stop and car park pins stay on the streets you can see when you zoom in.",
    tc: "拉近地圖時，畫面內的車站和停車場標記不會消失。",
    sc: "拉近地图时，画面内的车站和停车场标记不会消失。",
  },
  {
    id: "2026-10-05-parking-zoom",
    date: "2026-10-05",
    kind: "fixed",
    en: "With only car parks on, the pins stay on the map as you zoom in.",
    tc: "只看停車場時，拉近地圖，停車場標記仍然留在畫面上。",
    sc: "只看停车场时，拉近地图，停车场标记仍然留在画面上。",
  },
  {
    id: "2026-10-05-solo-zoom",
    date: "2026-10-05",
    kind: "improved",
    en: "With Only on, a quieter layer such as car parks or minibuses appears from farther away. KMB stays close in, because those stops cover the map.",
    tc: "開啟只看後，停車場或小巴等較疏的圖層會在較遠的比例顯示。九巴站多，仍然要拉近才顯示。",
    sc: "开启只看后，停车场或小巴等较疏的图层会在较远的比例显示。九巴站多，仍然要拉近才显示。",
  },
  {
    id: "2026-10-05-only-layer",
    date: "2026-10-05",
    kind: "added",
    en: "Choose Only, then a layer, to leave just that layer on the map.",
    tc: "先按只看，再選一層，地圖就只留該層。",
    sc: "先按只看，再选一层，地图就只留该层。",
  },
  {
    id: "2026-10-05-parking",
    date: "2026-10-05",
    kind: "added",
    en: "Car parks appear when the map is close. Opening one shows the published spaces.",
    tc: "地圖拉近後會顯示停車場。打開一個，會顯示已公布的空位。",
    sc: "地图拉近后会显示停车场。打开一个，会显示已公布的空位。",
  },
  {
    id: "2026-10-04-title",
    date: "2026-10-04",
    kind: "improved",
    en: "The browser tab title is 香港智慧城市交通情報網 by Keith Li.",
    tc: "瀏覽器分頁標題是香港智慧城市交通情報網 by Keith Li。",
    sc: "浏览器分页标题是香港智慧城市交通情报网 by Keith Li。",
  },
  {
    id: "2026-10-04-remember",
    date: "2026-10-04",
    kind: "added",
    en: "Language, map layers, and the intel card stay as you left them.",
    tc: "語言、地圖圖層和情報欄會保持你上次的選擇。",
    sc: "语言、地图图层和情报栏会保持你上次的选择。",
  },
  {
    id: "2026-10-04-heading",
    date: "2026-10-04",
    kind: "added",
    en: "Trains and ferries show where they are heading.",
    tc: "列車和渡輪顯示前往的地點。",
    sc: "列车和渡轮显示前往的地点。",
  },
  {
    id: "2026-10-04-stops",
    date: "2026-10-04",
    kind: "fixed",
    en: "Opening a stop shows the published arrival times. Choosing Boundary opens a control point that is open.",
    tc: "打開一站，會顯示已公布的到站時間。選擇管制站時，會前往開放的管制站。",
    sc: "打开一站，会显示已公布的到站时间。选择管制站时，会前往开放的管制站。",
  },
  {
    id: "2026-10-03-bus-direction",
    date: "2026-10-03",
    kind: "fixed",
    en: "When a bus operator publishes where a bus is going, that destination is written on the stop sign. Nearby signs no longer cover one another.",
    tc: "巴士營運商有公布目的地時，站牌會寫上該班車前往的地點。相近的站牌不再疊在一起。",
    sc: "巴士营运商有公布目的地时，站牌会写上该班车前往的地点。相近的站牌不再叠在一起。",
  },
  {
    id: "2026-10-03-harbour-from",
    date: "2026-10-03",
    kind: "improved",
    en: "The three harbour times are compared from the same roadside sign, the one nearest the map. You can choose another sign.",
    tc: "三條過海時間以同一個路口比較，預設是地圖上最近的路口，也可以另選起點。",
    sc: "三条过海时间以同一个路口比较，预设是地图上最近的路口，也可以另选起点。",
  },
  {
    id: "2026-10-03-gmb-dest",
    date: "2026-10-03",
    kind: "added",
    en: "A green minibus card shows where that minibus is going.",
    tc: "綠色專線小巴卡片顯示小巴前往的地點。",
    sc: "绿色专线小巴卡片显示小巴前往的地点。",
  },
  {
    id: "2026-10-03-satellite",
    date: "2026-10-03",
    kind: "improved",
    en: "The satellite picture on a phone is sharper.",
    tc: "手機上的衛星圖更清晰。",
    sc: "手机上的卫星图更清晰。",
  },
  {
    id: "2026-10-03-top-bar",
    date: "2026-10-03",
    kind: "improved",
    en: "On a phone, the top bar is one line. The tunnel times, weather, and speed stay on that line, clear of the map buttons.",
    tc: "在手機上，頂欄是一行。隧道時間、天氣和車速都在這一行，不會被地圖按鈕擋住。",
    sc: "在手机上，顶栏是一行。隧道时间、天气和车速都在这一行，不会被地图按钮挡住。",
  },
  {
    id: "2026-10-03-ferry-channel",
    date: "2026-10-03",
    kind: "fixed",
    en: "A ferry without a published position follows the harbour and the sea channel, instead of a straight line across Hong Kong Island.",
    tc: "沒有公布船位的渡輪，沿海港和航道顯示，不再以直線橫過香港島。",
    sc: "没有公布船位的渡轮，沿海港和航道显示，不再以直线横过香港岛。",
  },
  {
    id: "2026-10-03-ferry-move",
    date: "2026-10-03",
    kind: "added",
    en: "Ferries that do not publish a boat position are drawn on the crossing and move with the sailing time.",
    tc: "沒有公布船位的渡輪，會按開出和到達時間在航道上移動。",
    sc: "没有公布船位的渡轮，会按开出和到达时间在航道上移动。",
  },
  {
    id: "2026-10-03-ferry-gps",
    date: "2026-10-03",
    kind: "fixed",
    en: "When Sun Ferry publishes a boat position, the map uses that position.",
    tc: "新渡輪公布船位時，地圖使用該船位。",
    sc: "新渡轮公布船位时，地图使用该船位。",
  },
  {
    id: "2026-10-03-tsuen-wan",
    date: "2026-10-03",
    kind: "fixed",
    en: "Tsuen Wan line trains are shown with the other MTR lines.",
    tc: "荃灣綫列車與其他港鐵綫一同顯示。",
    sc: "荃湾线列车与其他港铁线一同显示。",
  },
  {
    id: "2026-10-03-arrivals",
    date: "2026-10-03",
    kind: "improved",
    en: "Bus and ferry arrival times keep updating while several feeds are open.",
    tc: "同時開啟多項到站資料時，巴士和渡輪的到站時間仍會更新。",
    sc: "同时开启多项到站资料时，巴士和渡轮的到站时间仍会更新。",
  },
  {
    id: "2026-10-02-places",
    date: "2026-10-02",
    kind: "added",
    en: "Green minibuses, New Lantao buses, and ferry piers are on the map.",
    tc: "地圖加入綠色專線小巴、嶼巴和渡輪碼頭。",
    sc: "地图加入绿色专线小巴、屿巴和渡轮码头。",
  },
  {
    id: "2026-10-02-sun",
    date: "2026-10-02",
    kind: "added",
    en: "Every Sun Ferry route in the public arrival feed is included, with the inter-island boats.",
    tc: "公開到站資料中的新渡輪航線都已加入，包括橫水渡。",
    sc: "公开到站资料中的新渡轮航线都已加入，包括横水渡。",
  },
  {
    id: "2026-10-02-fortune",
    date: "2026-10-02",
    kind: "added",
    en: "The Fortune Ferry timetable for North Point and Kwun Tong is shown, and marked as a timetable.",
    tc: "北角和觀塘的富裕小輪船期已顯示，並註明是船期。",
    sc: "北角和观塘的富裕小轮船期已显示，并注明是船期。",
  },
  {
    id: "2026-10-02-systems",
    date: "2026-10-02",
    kind: "added",
    en: "This card has a systems list for a feed that does not load.",
    tc: "情報卡加入系統分頁，列出未能讀取的資料。",
    sc: "情报卡加入系统分页，列出未能读取的资料。",
  },
  {
    id: "2026-10-02-ferry-place",
    date: "2026-10-02",
    kind: "fixed",
    en: "A ferry card names where the boat is going, or where it is coming from.",
    tc: "渡輪卡片顯示船隻前往或駛來的地點。",
    sc: "渡轮卡片显示船只前往或驶来的地点。",
  },
  {
    id: "2026-10-02-berths",
    date: "2026-10-02",
    kind: "fixed",
    en: "Ferry pier pins sit on the passenger berths.",
    tc: "渡輪碼頭標記放在乘客碼頭的位置。",
    sc: "渡轮码头标记放在乘客码头的位置。",
  },
  {
    id: "2026-10-02-nlb",
    date: "2026-10-02",
    kind: "fixed",
    en: "New Lantao Bus arrival times use the Hong Kong clock.",
    tc: "嶼巴到站時間按香港時間顯示。",
    sc: "屿巴到站时间按香港时间显示。",
  },
  {
    id: "2026-10-02-gmb-zoom",
    date: "2026-10-02",
    kind: "improved",
    en: "Green minibus stops appear when the map is close enough to read them.",
    tc: "地圖放大至足以閱讀時，才顯示綠色專線小巴車站。",
    sc: "地图放大至足以阅读时，才显示绿色专线小巴车站。",
  },
  {
    id: "2026-10-02-routes",
    date: "2026-10-02",
    kind: "improved",
    en: "A stop still lists its routes when no arrival time is published.",
    tc: "車站未有到站時間時，仍會列出路線編號。",
    sc: "车站未有到站时间时，仍会列出路线编号。",
  },
  {
    id: "2026-10-02-crossing",
    date: "2026-10-02",
    kind: "fixed",
    en: "A harbour crossing with no published time is left off the bar.",
    tc: "沒有公布時間的過海航程不會出現在頂欄。",
    sc: "没有公布时间的过海航程不会出现在顶栏。",
  },
]

export function changelogText(entry: ChangelogEntry, locale: Locale): string {
  switch (locale) {
    case "en":
      return entry.en
    case "zh-CN":
      return entry.sc
    case "zh-HK":
      return entry.tc
    default: {
      const exhaustive: never = locale
      return exhaustive
    }
  }
}
