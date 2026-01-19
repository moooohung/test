const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');

/**
 * mgf.gg 랭킹 크롤러 (전체 데이터)
 * - 일반 랭킹 (플레이어): https://mgf.gg/ranking
 * - 길드 랭킹: https://mgf.gg/ranking/guild_ranking.php
 */

const PLAYER_URL = 'https://mgf.gg/ranking';
const GUILD_URL = 'https://mgf.gg/ranking/guild_ranking.php';
const MAX_PLAYER_PAGES = 200;  // 전체 플레이어 (약 6000명)
const MAX_GUILD_PAGES = 500;   // 전체 길드

// 직업별 아이콘 매핑
const JOB_ICONS = {
  '나이트로드': 'nightlord',
  '다크나이트': 'darkknight',
  '보우마스터': 'bowmaster',
  '섀도어': 'shadower',
  '신궁': 'marksman',
  '아크메이지(불,독)': 'mage_fd',
  '아크메이지(썬,콜)': 'mage_sc',
  '히어로': 'hero',
  '팔라딘': 'paladin',
  '비숍': 'bishop'
};

// 아이콘 다운로드 함수
async function downloadIcon(jobId, outputDir) {
  const url = `https://mgf.gg/sim/assets/companion_jobs/${jobId}.png`;
  const filePath = path.join(outputDir, `${jobId}.png`);
  
  if (fs.existsSync(filePath)) {
    return; // 이미 존재
  }
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`  Downloaded: ${jobId}.png`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filePath, () => {});
      console.log(`  Failed: ${jobId}.png - ${err.message}`);
      resolve(); // 실패해도 계속 진행
    });
  });
}

(async () => {
  console.log('🚀 Starting mgf.gg rankings crawler (FULL DATA)...\n');
  
  // 아이콘 디렉토리 생성 및 다운로드
  const iconDir = path.join(__dirname, 'public', 'assets', 'meki', 'images', 'jobs');
  fs.mkdirSync(iconDir, { recursive: true });
  
  console.log('📥 Downloading job icons...');
  for (const [jobName, jobId] of Object.entries(JOB_ICONS)) {
    await downloadIcon(jobId, iconDir);
  }
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'ko-KR'
  });
  
  const allPlayers = [];
  const allGuilds = [];
  
  try {
    // ===== 일반 랭킹 (플레이어) 크롤링 =====
    console.log('\n📊 Crawling player rankings (ALL PAGES)...');
    const playerPage = await context.newPage();
    
    for (let pageNum = 1; pageNum <= MAX_PLAYER_PAGES; pageNum++) {
      const url = pageNum === 1 ? PLAYER_URL : `${PLAYER_URL}?page=${pageNum}`;
      if (pageNum % 10 === 1) console.log(`  Pages ${pageNum}-${Math.min(pageNum+9, MAX_PLAYER_PAGES)}...`);
      
      try {
        await playerPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await playerPage.waitForTimeout(800);
        
        const players = await playerPage.$$eval('table tbody tr', (rows) => {
          return rows.map(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 4) return null;
            
            const rank = parseInt(cells[0]?.innerText.replace(/[^\d]/g, '')) || 0;
            
            // 닉네임: .nickname 클래스에서 추출
            const nicknameEl = cells[1]?.querySelector('.nickname');
            const nickname = nicknameEl?.innerText.trim() || '';
            
            // 레벨: .level 클래스에서 추출
            const levelEl = cells[1]?.querySelector('.level');
            const level = levelEl ? parseInt(levelEl.innerText.replace(/[^\d]/g, '')) : 0;
            
            // 직업: img.job-icon-profile의 alt 속성에서 추출
            const jobIcon = cells[1]?.querySelector('img.job-icon-profile');
            const job = jobIcon?.alt || '';
            
            const server = cells[2]?.innerText.trim() || '';
            const power = cells[3]?.innerText.trim() || '';
            
            return { rank, nickname, level, job, server, power };
          }).filter(r => r && r.rank > 0 && r.nickname);
        });
        
        allPlayers.push(...players);
        
        if (players.length === 0) {
          console.log(`    No more data at page ${pageNum}`);
          break;
        }
      } catch (err) {
        console.log(`    Error on page ${pageNum}: ${err.message}`);
        break;
      }
    }
    
    await playerPage.close();
    console.log(`  Total players fetched: ${allPlayers.length}`);
    
    // ===== 길드 랭킹 크롤링 =====
    console.log('\n🏰 Crawling guild rankings (ALL PAGES)...');
    const guildPage = await context.newPage();
    
    for (let pageNum = 1; pageNum <= MAX_GUILD_PAGES; pageNum++) {
      const url = pageNum === 1 ? GUILD_URL : `${GUILD_URL}?page=${pageNum}`;
      if (pageNum % 20 === 1) console.log(`  Pages ${pageNum}-${Math.min(pageNum+19, MAX_GUILD_PAGES)}...`);
      
      try {
        await guildPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await guildPage.waitForTimeout(800);
        
        const guilds = await guildPage.$$eval('table tbody tr', (rows) => {
          return rows.map(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 4) return null;
            
            const rank = parseInt(cells[0]?.innerText.replace(/[^\d]/g, '')) || 0;
            const guildInfo = cells[1]?.innerText.trim().split('\n').map(s => s.trim()).filter(s => s);
            const name = guildInfo[0] || '';
            const levelMatch = guildInfo.find(s => s.match(/Lv\.\s*\d+/i));
            const level = levelMatch ? parseInt(levelMatch.replace(/[^\d]/g, '')) : 0;
            const membersText = cells[2]?.innerText.trim() || '0/0';
            const membersMatch = membersText.match(/(\d+)\s*\/\s*(\d+)/);
            const members = membersMatch ? parseInt(membersMatch[1]) : 0;
            const maxMembers = membersMatch ? parseInt(membersMatch[2]) : 30;
            const server = cells[3]?.innerText.trim() || '';
            const power = cells[4]?.innerText.trim() || '';
            
            return { rank, name, level, members, maxMembers, server, power };
          }).filter(r => r && r.rank > 0 && r.name);
        });
        
        allGuilds.push(...guilds);
        
        if (guilds.length === 0) {
          console.log(`    No more data at page ${pageNum}`);
          break;
        }
      } catch (err) {
        console.log(`    Error on page ${pageNum}: ${err.message}`);
        break;
      }
    }
    
    await guildPage.close();
    console.log(`  Total guilds fetched: ${allGuilds.length}`);
    
  } catch (error) {
    console.error('❌ Crawl error:', error.message);
  } finally {
    await browser.close();
  }
  
  // Deduplicate
  const uniquePlayers = [...new Map(allPlayers.map(p => [p.rank, p])).values()];
  const uniqueGuilds = [...new Map(allGuilds.map(g => [g.rank, g])).values()];
  
  uniquePlayers.sort((a, b) => a.rank - b.rank);
  uniqueGuilds.sort((a, b) => a.rank - b.rank);
  
  console.log(`\n📈 Unique players: ${uniquePlayers.length}`);
  console.log(`📈 Unique guilds: ${uniqueGuilds.length}`);
  
  // Save to file
  const output = {
    updated_at: new Date().toISOString(),
    players: {
      total: uniquePlayers.length,
      data: uniquePlayers
    },
    guilds: {
      total: uniqueGuilds.length,
      data: uniqueGuilds
    }
  };
  
  const outputPath = path.join(__dirname, 'public', 'data', 'meki', 'rankings.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  
  console.log(`\n✅ Saved to ${outputPath}`);
  console.log('🎉 Done!');
})();
