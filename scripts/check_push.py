"""Read-only push hygiene check. Never prints credential values or edits Git."""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def git(*args):
    return subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace')


def main():
    blockers = []
    ignored = git('ls-files', '-ci', '--exclude-standard').stdout.splitlines()
    if ignored:
        blockers.append(f'{len(ignored)} ignored/generated/private files are still tracked; .gitignore does not untrack them.')
        for name in ('backend/db.sqlite3', 'backend/models/rambutan_guard/open_clip_model.safetensors'):
            if name in ignored:
                blockers.append(f'Tracked file requires removal from the publishable repository: {name}')

    for line in git('ls-tree', '-rl', 'HEAD').stdout.splitlines():
        metadata, _, path = line.partition('\t')
        parts = metadata.split()
        if len(parts) >= 4 and parts[3].isdigit() and int(parts[3]) > 100 * 1024 * 1024:
            blockers.append(f'Large blob already in HEAD: {path} ({int(parts[3]) / 1024 / 1024:.1f} MiB); untracking alone leaves history intact.')

    secret = re.compile(r"SECRET_KEY\s*=\s*['\"][^'\"]{20,}['\"]")
    for revision, label in ((':backend/backend/settings.py', 'staged settings'), ('HEAD:backend/backend/settings.py', 'committed settings')):
        if secret.search(git('show', revision).stdout):
            blockers.append(f'A hardcoded Django secret remains in {label}. Rotate exposed credentials and review history before publication.')

    paths = git('ls-files', '--cached', '--others', '--exclude-standard').stdout.splitlines()
    for name in dict.fromkeys(paths):
        if not name.startswith(('src/', 'backend/', 'scripts/')) or name in ignored:
            continue
        path = ROOT / name
        if not path.is_file() or path.suffix not in ('.py', '.js', '.jsx', '.mjs', '.ts', '.tsx', '.json', '.md'):
            continue
        if re.search(r'^(<<<<<<< |=======\s*$|>>>>>>> )', path.read_text(encoding='utf-8', errors='replace'), re.MULTILINE):
            blockers.append(f'Unresolved conflict marker: {name}')
    for args in (('diff', '--check'), ('diff', '--cached', '--check')):
        result = git(*args)
        if result.returncode:
            blockers.append('Whitespace/conflict check failed: git ' + ' '.join(args))
    if blockers:
        print('NOT READY TO PUSH')
        for blocker in blockers:
            print('- ' + blocker)
        return 1
    print('Push hygiene checks passed. Review the intended staged source changes and test results before committing.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
