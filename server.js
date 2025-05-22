const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');


const app = express();
const port = process.env.PORT || 5000;

// CORS 설정
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// 환경변수 확인
const dbUri = process.env.DB_URI;
if (!dbUri) {
  console.error("❌ DB_URI 환경변수가 설정되지 않았습니다.");
  process.exit(1);
}

// MongoDB 연결
mongoose.connect(dbUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  ssl: true,
})
.then(() => console.log("✅ MongoDB 연결 성공"))
.catch((err) => {
  console.error("❌ MongoDB 연결 실패:", err.message);
  process.exit(1);
});

// 모델 정의
const flowerSchema = new mongoose.Schema({
  flowername: String,
  habitat: String,
  binomialName: String,
  classification: String,
  flowername_kr: String
});
const Flower = mongoose.model('Flower', flowerSchema, 'flowers');

// 꽃 정보 API
app.get('/flowers', async (req, res) => {
  const flowername = req.query.flowername;
  try {
    const flower = await Flower.findOne({
      $or: [
        { flowername },
        { flowername_kr: flowername }
      ]
    });

    if (!flower) {
      return res.status(404).json({ error: 'Flower not found' });
    }

    const { flowername: name, habitat, binomialName, classification, flowername_kr } = flower;
    res.json({ flowername: name, habitat, binomialName, classification, flowername_kr });
  } catch (error) {
    console.error('❌ 꽃 정보 조회 오류:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

// 네이버 쇼핑 검색 API
app.get('/naver-shopping', async (req, res) => {
  const flowername = req.query.flowername;

  if (!flowername) {
    return res.status(400).json({ error: 'Flowername is required' });
  }

  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Naver API credentials missing' });
  }

  let start = 1;
  const displayPerPage = 100;
  const maxResults = 1000;

  async function fetchNaverShoppingResults() {
    const allResults = [];

    while (start <= maxResults) {
      try {
        const apiUrl = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(flowername)}&display=${displayPerPage}&start=${start}&sort=sim`;

        const response = await axios.get(apiUrl, {
          headers: {
            'X-Naver-Client-Id': clientId,
            'X-Naver-Client-Secret': clientSecret,
          },
        });

        const items = response.data.items || [];
        if (items.length === 0) break;

        allResults.push(...items);
        start += displayPerPage;

      } catch (err) {
        console.error('❌ 네이버 쇼핑 API 오류:', err.message);
        throw err;
      }
    }

    return allResults;
  }

  try {
    const data = await fetchNaverShoppingResults();
    res.json({ items: data });
  } catch (error) {
    res.status(500).json({ error: 'Naver Shopping API error' });
  }
});

// 서버 실행
app.listen(port, () => {
  console.log(`🚀 Server is running on http://localhost:${port}`);
});


