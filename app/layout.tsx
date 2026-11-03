import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={ title:"Pattern / Prompt Studio",description:"Build, run, and refine prompt chains." };
const themeInit=`try{var m=localStorage.getItem('pattern-studio-theme')||'system';var d=m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}`;
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeInit}}/></head><body>{children}</body></html>;}
