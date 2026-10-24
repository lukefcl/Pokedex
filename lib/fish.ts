import catalogue from './species.json';

export type Habitat = 'Coastal' | 'Reef' | 'Open water' | 'Deep water' | 'Estuary' | 'Freshwater' | 'Shore';
export type Category = 'Finfish' | 'Sharks & rays' | 'Freshwater' | 'Kaimoana';
export type Fish = {
  id:string; name:string; maori:string; scientific:string; slug:string;
  habitat:Habitat; category:Category; description:string; clue:string; funFact:string;
  aliases:string; sourceUrl:string; imageCredit:string;
  creditLinks:{text:string;url:string}[]; protected:boolean;
};
export const fish = catalogue as Fish[];
export const categories:Category[] = ['Finfish','Sharks & rays','Freshwater','Kaimoana'];
export const habitats:Habitat[] = ['Coastal','Reef','Open water','Deep water','Estuary','Freshwater','Shore'];
export const unidentified:Fish = {
  id:'other', name:'Identify later', maori:'', scientific:'Identification pending', slug:'unidentified',
  habitat:'Coastal', category:'Finfish', description:'Save a photo and your own name for any catch outside the catalogue.',
  clue:'Record the location and markings to help identify your catch later.', funFact:'', aliases:'',sourceUrl:'',imageCredit:'',creditLinks:[],protected:false,
};
export const findFish = (id:string) => id === unidentified.id ? unidentified : fish.find(entry=>entry.id===id);
export const catchFish = (record:{fishId:string}) => findFish(record.fishId) || unidentified;
export const catchName = (record:{fishId:string;customName?:string}) => record.fishId === unidentified.id ? record.customName || unidentified.name : catchFish(record).name;
