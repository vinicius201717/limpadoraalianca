import "server-only";
import {inflateSync} from "node:zlib";

// The delivery UI creates a non-interlaced, 8-bit RGBA canvas PNG.
// Bound decompression and validate pixels, not merely the data URL prefix.
const magic=Buffer.from([137,80,78,71,13,10,26,10]);
function crc32(bytes:Buffer){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function paeth(a:number,b:number,c:number){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
export function isValidDeliverySignature(value:string){
 try{
  const prefix="data:image/png;base64,";
  if(!value.startsWith(prefix)||value.length>600000)return false;
  const encoded=value.slice(prefix.length);if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))return false;
  const bytes=Buffer.from(encoded,"base64");if(!bytes.subarray(0,8).equals(magic))return false;
  let offset=8,width=0,height=0,channels=0,ended=false,seenData=false;const chunks:Buffer[]=[];
  while(offset+12<=bytes.length){
   const len=bytes.readUInt32BE(offset),end=offset+12+len;if(end>bytes.length)return false;
   const type=bytes.toString("ascii",offset+4,offset+8),data=bytes.subarray(offset+8,offset+8+len);
   if(crc32(bytes.subarray(offset+4,end-4))!==bytes.readUInt32BE(end-4))return false;
   if(offset===8&&type!=="IHDR")return false;
   if(type==="IHDR"){
    if(width||len!==13)return false;width=data.readUInt32BE(0);height=data.readUInt32BE(4);
    channels=data[9]===6?4:data[9]===2?3:0;
    if(width!==720||height!==240||data[8]!==8||!channels||data[10]||data[11]||data[12])return false;
   }else if(type==="IDAT"){if(!width)return false;seenData=true;chunks.push(data);}
   else if(type==="IEND"){if(len||!seenData||end!==bytes.length)return false;ended=true;break;}
   else if(!/^[a-z][A-Za-z]{3}$/.test(type))return false;
   offset=end;
  }
  if(!ended)return false;
  const stride=width*channels,expected=height*(stride+1),raw=inflateSync(Buffer.concat(chunks),{maxOutputLength:expected});
  if(raw.length!==expected)return false;
  let prev=Buffer.alloc(stride),ink=0,minX=width,maxX=-1,minY=height,maxY=-1;
  for(let y=0;y<height;y++){
   const filter=raw[y*(stride+1)];if(filter>4)return false;
   const row=Buffer.alloc(stride);
   for(let i=0;i<stride;i++){
    const a=i>=channels?row[i-channels]:0,b=prev[i],c=i>=channels?prev[i-channels]:0;
    row[i]=(raw[y*(stride+1)+1+i]+(filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):filter===4?paeth(a,b,c):0))&255;
   }
   for(let x=0;x<width;x++){const i=x*channels;if((channels===3||row[i+3]>96)&&row[i]<150&&row[i+1]<150&&row[i+2]<150){ink++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}}
   prev=row;
  }
  return ink>=24&&ink<width*height/2&&maxX-minX>=12&&maxY-minY>=3;
 }catch{return false;}
}
