import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';

import Header from '../components/Header';
import Hero from '../components/Hero';
import Stats from '../components/Stats';
import Projects from '../components/Projects';
import Services from '../components/Services';
import Process from '../components/Process';
import Insights from '../components/Insights';
import DynamicForms from '../components/DynamicForms';
import Footer from '../components/Footer';

import { SiteData } from '../types';

export default async function Storefront(props: { searchParams: Promise<{ user_id?: string, lang?: string, key?: string }> }) {
    const searchParams = await props.searchParams;
    const userId = searchParams.user_id || '123e4567-e89b-12d3-a456-426614174000';
    const lang = searchParams.lang || 'en';
    const key = searchParams.key;

    let data;
    let error;

    if (key) {
        const res = await supabase.from('cms_data').select('data').eq('data->draft->en->brand->>formKey', key).single();
        data = res.data;
        error = res.error;
    } else {
        const res = await supabase.from('cms_data').select('data').eq('user_id', userId).single();
        data = res.data;
        error = res.error;
    }

    if (error || !data) return notFound();

    const activeData: SiteData = data.data.published[lang];
    const formKey = activeData.brand?.formKey || key;

    return (
        <>
            <Header 
                brand={activeData.brand} 
                nav={activeData.nav} 
                headerAction={activeData.headerAction} 
                userId={userId} 
                lang={lang} 
            />

            <Hero hero={activeData.hero} />
            <Stats stats={activeData.stats} />
            <Projects projects={activeData.projectsSection} />
            <Services services={activeData.servicesSection} />
            <Process process={activeData.processSection} />
            <Insights insights={activeData.insightsSection} />
            
            <DynamicForms 
                forms={activeData.forms || []} 
                formKey={formKey} 
                lang={lang} 
            />

            <Footer 
                footer={activeData.footer} 
                brandText={activeData.brand?.sub} 
            />
        </>
    );
}
