from pathlib import Path

p=Path('src/server.js')
s=p.read_text()

s=s.replace("version:'0.6.0'", "version:'0.7.0'")
s=s.replace("version:'0.5.0'", "version:'0.7.0'")

old="return send(res,200,{items:contextKernel.list(),exposure:contextKernel.exposure()});"
new="return send(res,200,{items:contextKernel.list(),exposure:contextKernel.exposure(),partition:contextKernel.partitionExposure()});"
assert old in s
s=s.replace(old,new,1)

old="return send(res,200,{fields:contextKernel.exposure()});"
new="return send(res,200,{fields:contextKernel.exposure(),partition:contextKernel.partitionExposure()});"
assert old in s
s=s.replace(old,new,1)

old="const item=contextKernel.put(String(b.path),b.value,{label:b.label??null,category:String(b.category??'general'),tags:Array.isArray(b.tags)?b.tags:[]});"
new="const item=contextKernel.put(String(b.path),b.value,{label:b.label??null,category:String(b.category??'general'),tags:Array.isArray(b.tags)?b.tags:[],domain:b.domain??undefined});"
assert old in s
s=s.replace(old,new,1)

p.write_text(s)

p=Path('package.json')
s=p.read_text()
s=s.replace('"version":"0.6.0"','"version":"0.7.0"',1)
p.write_text(s)

print('partition API integration applied')
