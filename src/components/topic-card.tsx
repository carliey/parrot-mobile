import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type { Lesson } from '@/data/lessons';
export function TopicCard({lesson,kind}:{lesson:Lesson;kind:'lesson'|'session'}) {
 return <Link href={`/${kind}/${lesson.id}` as never} asChild><Pressable accessibilityRole="button" style={{backgroundColor:lesson.color,borderRadius:24,padding:24,minHeight:184,justifyContent:'space-between'}}><View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={{fontSize:33,color:'#224339'}}>{lesson.icon}</Text><Text style={{fontSize:25,color:'#224339'}}>↗</Text></View><View><Text style={{fontSize:25,fontWeight:'700',color:'#173B32'}}>{lesson.title}</Text><Text style={{fontSize:15,color:'#355348',lineHeight:22,marginTop:5}}>{lesson.description}</Text></View></Pressable></Link>;
}
