# MGF Rankings Crawler

메이플 키우기 랭킹 데이터를 mgf.gg에서 크롤링하는 GitHub Actions 워크플로우.

## 사용법

1. 이 레포를 fork하거나 clone
2. GitHub Actions가 자동으로 KST 06:00, 10:00, 14:00, 18:00, 24:00에 실행
3. 결과는 `public/data/meki/rankings.json`에 저장

## 수동 실행

Actions 탭 → "Meki Rankings Crawler" → "Run workflow" 클릭

## 파일 구조

```
├── .github/workflows/crawl-rankings.yml  # GitHub Actions 워크플로우
├── crawl_rankings.cjs                    # 크롤러 스크립트
├── package.json                          # 의존성
└── public/data/meki/                     # 결과 데이터
```

## 데이터 형식

```json
{
  "updated_at": "2026-01-18T13:57:47.736Z",
  "players": {
    "total": 150,
    "data": [
      {
        "rank": 1,
        "nickname": "닉네임",
        "level": 110,
        "job": "직업명",
        "server": "Scania 10",
        "power": "7681조 3789억"
      }
    ]
  },
  "guilds": {
    "total": 150,
    "data": [...]
  }
}
```
