@echo off
echo ShareChat �Z�b�g�A�b�v���f�v���C�X�N���v�g
echo ====================================

echo 1. cors-config.json�̑��݂��m�F��...
if not exist "cors-config.json" (
  echo cors-config.json��������܂���B�쐬���܂�...
  echo [> cors-config.json
  echo   {>> cors-config.json
  echo     "origin": ["*"],>> cors-config.json
  echo     "method": ["GET", "HEAD", "OPTIONS"],>> cors-config.json
  echo     "responseHeader": ["Content-Type", "Content-Length", "Cache-Control", "Content-Language", "Content-Encoding", "Content-Range", "Access-Control-Allow-Origin"],>> cors-config.json
  echo     "maxAgeSeconds": 3600>> cors-config.json
  echo   }>> cors-config.json
  echo ]>> cors-config.json
)

echo 2. �o�P�b�g�ݒ�����s��...
call .\setup-bucket.bat
if %errorlevel% neq 0 (
  echo �o�P�b�g�ݒ�Ɏ��s���܂����B
  exit /b 1
)

echo 3. �t�����g�G���h�̃f�v���C�����s��...
call .\deploy-frontend.bat
if %errorlevel% neq 0 (
  echo �t�����g�G���h�f�v���C�Ɏ��s���܂����B
  exit /b 1
)

echo ====================================
echo �Z�b�g�A�b�v�ƃf�v���C���������܂����I
echo �A�v���P�[�V����URL: https://storage.googleapis.com/sharechat-media-bucket/frontend/index.html
echo ====================================
