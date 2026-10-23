# Soundi Web Controller 10

전시 및 테스트용 로컬 실행본입니다.

## 실행

```sh
npm start
```

기본 주소는 `http://localhost:8126/`입니다.

## 환경변수

`.env.example`을 참고해 로컬 전시용 Mac에만 `.env`를 만드세요. 공개 zip이나 저장소에는 실제 secret key를 넣지 마세요.

- `OPENAI_API_KEY`: AI 코치 서버 응답에 사용합니다. 없으면 브라우저가 로컬 분석으로 대체합니다.
- `SUPABASE_SECRET_KEY`: 서버 측 관리자 삭제에만 사용합니다.
- 관리자 로그인 비밀번호는 `server.js`에서 `1021`로 고정되어 있습니다.

## 전시 설치 메모

Xcode는 iPhone, Apple Watch, iPad 안에 설치하는 앱이 아니라 Mac에 설치합니다. 전시장에서는 Mac에 Xcode를 설치하고, 테스트용 iPhone/iPad/Watch를 케이블 또는 무선 디버깅으로 연결해 설치하는 흐름이 안정적입니다.

## 2026-09-04 V-A-T color mapping update
- Final circle colors no longer use the legacy fixed mood palettes as their source.
- Valence + Arousal select the continuous base color region.
- Valence controls brightness, Arousal controls saturation, and Tension controls palette contrast.
- Legacy mood keys remain for existing labels/compatibility only.



## 2026-09-04 playback / UI update
- Playback mood sphere now recalculates a local 8-step V-A-T window and smoothly interpolates its four color channels while the song plays.
- At rest, the sphere returns to the whole-song V-A-T palette.
- Korean publish label: 게시하다 / English: Post.
- My Works becomes 저장된 곡 in Korean.
- Dark mode gives the My Works + button an explicit gray surface.
- Harmony Guide automatically turns off in Example mode.

- 관리자 로그인 비밀번호를 서버에서 `1021`로 고정했습니다. 별도 `SOUNDI_ADMIN_PASSWORD` 환경변수가 없어도 동작합니다.
- 홈 첫 화면 스크롤 안내를 한글 모드에서 `아래로 / 스크롤해 주세요`, 영어 모드에서 `please / scroll`로 표시합니다.


## 2026-09-05 관리자 로그인/커서 수정
- 관리자 비밀번호 `1021`을 클라이언트에서도 검증해 이전 서버 환경변수 상태에 로그인 자체가 막히지 않도록 수정했습니다.
- 서버가 최신 버전이면 기존처럼 관리자 토큰도 받아옵니다.
- 로그인 화면에서 커서 옆 안내 문구는 라이트/다크모드 모두 흰색으로 표시됩니다.
- 로그인 완료 후 커서 문구는 `반가워요/Welcome`이 남지 않고 홈의 `아래로 / 스크롤해 주세요` 또는 `please / scroll` 안내로 복귀합니다.


## 2026-09-14 Glass mood sphere
- The composition feedback uses a local Three.js r180 sphere with translucent colour membranes and studio reflections.
- Existing whole-song and playback-window V-A-T colours feed the shader; energy controls flow speed and tension controls colour contrast. Palette changes interpolate smoothly.
- `sphere-preview.html` offers sample palettes and light/dark backgrounds for visual review. These samples do not replace the actual analysis palette.
- Three.js files and their MIT license are included in `vendor/`; no runtime CDN is needed for the sphere. Serve over HTTP with `npm start`.
- The existing CSS visual remains available when WebGL is unavailable or its context is lost. Motion respects reduced-motion preferences and rendering pauses outside the viewport or in a hidden document.
- Validation: `npm run check`; browser checks of sample palette switching, both backgrounds, and example-song playback with one canvas and no renderer errors.

## 2026-09-14 Glass study 02
- Replaced the painted surface shader with MeshPhysicalMaterial: real sphere geometry, transmission, IOR, thickness, dispersion, and an HDR studio environment.
- Two closed, animated 3D lenses form the interior. A separate half-float render target supports nested glass refraction through the outer shell.
- Added a subtle floating shadow, 30 fps rendering cap, theme-matched backdrop, and disposal for all added GPU resources. Existing analysis events and palette interpolation remain connected.


## 2026-09-21 Orb studio 05
- Replaced the previous volume renderer with a vanilla WebGL2 adaptation of SmoothUI Orb (Eduardo Calvo, MIT). The shader uses a sphere impostor, not a polygonal glass model.
- Preserves the source's OkLab colour interpolation, flowing noise, fine grain, internal light and rim highlights. Extends the palette to 2–6 colours.
- Adds independent contour amplitude, wave count, speed, irregularity and breathing controls. No floor shadow or outer glow.
- Composition playback retains the existing palette/energy/tension event contract; palettes and motion values interpolate. The preview provides manual controls and four sample palettes, including an Aurora-inspired palette without a black colour stop.
- Preview settings apply only to the preview; the composition view uses its existing V-A-T analysis.
- Licensing: `vendor/SMOOTHUI-LICENSE.txt` contains the original copyright and MIT license; `THIRD_PARTY_NOTICES.md` records the source and modifications. Liquid Orb Editor was a visual reference; its code was not copied.
- At the user's request, this revision was implemented without executing tests, syntax checks, browser inspection or screenshots.
