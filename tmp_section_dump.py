from pathlib import Path
path = Path('src/lib/assistant/tools.ts')
lines = path.read_text().splitlines()
functions = [456,508,574,743,813,841,870,888,914,1037,1152]
for idx in functions:
    start = max(0, idx-5)
    end = min(len(lines), idx+200)
    print('--- start at', idx, '---')
    for i in range(start, min(end, len(lines))):
        print(f"{i+1}: {lines[i]}")
    print('--- end ---\n')
