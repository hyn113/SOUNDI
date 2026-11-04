"""Reject a packaged site with missing HTML assets or a broken auth SDK."""
import sys
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote

root = Path(sys.argv[1]).resolve()
errors = []
checked = 0
class Assets(HTMLParser):
    def __init__(self, page):
        super().__init__()
        self.page = page
    def handle_starttag(self, tag, attrs):
        global checked
        attrs = dict(attrs)
        raw = attrs.get('src') if tag in ('script', 'img', 'source') else attrs.get('href') if tag == 'link' else None
        if not raw:
            return
        url = urlsplit(raw)
        if url.scheme or url.netloc or not url.path:
            return
        path = (root / unquote(url.path).lstrip('/')) if url.path.startswith('/') else self.page.parent / unquote(url.path)
        checked += 1
        if not path.is_file():
            errors.append(f'{self.page.relative_to(root)}: missing {raw}')

for page in root.rglob('*.html'):
    Assets(page).feed(page.read_text())
sdk = root / 'vendor/supabase/supabase-2.112.3.min.js'
if not sdk.is_file() or sdk.stat().st_size < 10000:
    errors.append('Login SDK is missing or truncated')
for tile in ('light', 'dark'):
    if not (root / f'vendor/soundi/compose-grid-{tile}.svg').is_file():
        errors.append(f'Missing {tile} composer grid')
if errors:
    print('\n'.join(errors), file=sys.stderr)
    sys.exit(1)
print(f'Validated {checked} local HTML assets, login SDK, and grid tiles.')
