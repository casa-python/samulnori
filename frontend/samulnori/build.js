const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Samulnori 앱 빌드 시작...');

try {
  // 1. 기존 빌드 파일 정리
  console.log('📁 기존 빌드 파일 정리 중...');
  const distPath = path.join(__dirname, 'dist');
  const releasePath = path.join(__dirname, 'release');
  
  if (fs.existsSync(distPath)) {
    fs.rmSync(distPath, { recursive: true, force: true });
  }
  
  if (fs.existsSync(releasePath)) {
    fs.rmSync(releasePath, { recursive: true, force: true });
  }

  // 2. Vite로 React 앱 빌드
  console.log('⚛️ React 앱 빌드 중...');
  execSync('npm run build', { stdio: 'inherit', cwd: __dirname });

  // 3. Electron Builder로 실행 파일 생성 (--dir 옵션 사용)
  console.log('🔧 Electron 앱 패키징 중...');
  execSync('npx electron-builder --dir', { stdio: 'inherit', cwd: __dirname });

  console.log('✅ 빌드 완료!');
  console.log('📦 실행 파일 위치:', releasePath);
  
  // 4. 빌드 결과 확인
  if (fs.existsSync(releasePath)) {
    const files = fs.readdirSync(releasePath);
    console.log('📋 생성된 파일들:');
    files.forEach(file => {
      console.log(`   - ${file}`);
    });
  }

} catch (error) {
  console.error('❌ 빌드 실패:', error.message);
  process.exit(1);
}
