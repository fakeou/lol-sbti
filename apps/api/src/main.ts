import { Pool } from "pg";import { Repository } from "@lol-sbti/persistence";import { buildApp } from "./app.js";
const required=(name:string)=>{const value=process.env[name];if(!value)throw new Error(`${name} is required`);return value};
const key=Buffer.from(required("INPUT_ENCRYPTION_KEY"),"base64");const pool=new Pool({connectionString:required("DATABASE_URL")});const app=buildApp(new Repository(pool,required("SERVER_PEPPER"),key));await app.listen({host:"0.0.0.0",port:Number(process.env.PORT??3001)});
