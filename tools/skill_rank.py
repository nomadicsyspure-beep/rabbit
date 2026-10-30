"""tools/skill_bench.cjs 결과(bench.json)로 형태별 순위·점수를 낸다. 실행한 폴더에 ranked.json도 쓴다."""
import json, statistics as st, re, sys
D = ""
r=json.load(open(D+'bench.json'))
base=r['base']
HP=75
bk=st.mean(x['kills'] for x in base); bnet=st.mean(x['taken']-x['healed']+HP*x['deaths'] for x in base)
out={}
for row in r['rows']:
    runs=row['runs']; t=row['type']
    if t in ('attack','target'):
        score=st.mean(x['dmg'] for x in runs); extra=f"피해 {score:.0f} 처치 {st.mean(x['kills'] for x in runs):.0f}"
    else:
        k=st.mean(x['kills'] for x in runs); net=st.mean(x['taken']-x['healed']+HP*x['deaths'] for x in runs)
        kr=k/bk; sr=min(3,(bnet+30)/(max(net,-29)+30))
        score=0.5*kr+0.5*sr; extra=f"처치 x{kr:.2f} 생존 x{sr:.2f} 쓰러짐 {st.mean(x['deaths'] for x in runs):.1f}"
    out.setdefault(t,[]).append((row['id'],score,extra))
def grades(n):
    # 형태 안에서 순위로: 위 15% S · 20% A · 30% B · 20% C · 15% D
    cuts=[round(n*c) for c in (0.15,0.35,0.65,0.85)]
    return ['S' if i<cuts[0] else 'A' if i<cuts[1] else 'B' if i<cuts[2] else 'C' if i<cuts[3] else 'D' for i in range(n)]
result={}
for t in ['attack','target','debuff','buff']:
    rows=sorted(out[t], key=lambda x:-x[1]); m=st.median(s for _,s,_ in rows)
    result[t]=[(i,s,g,e) for (i,s,e),g in zip(rows,grades(len(rows)))]
    print('==',t,'median',round(m,2), f"base kills {bk:.0f} net {bnet:.0f}" if t in('debuff','buff') else '')
    for n,(i,s,g,e) in enumerate(result[t]): print(f"{n+1:2d} {g} {i:13s} {s:8.2f}  {e}")
json.dump(result, open(D+'ranked.json','w'), ensure_ascii=False)
