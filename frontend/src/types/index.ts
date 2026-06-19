export interface BrandData {
    icon: string;
    name: string;
    sub: string;
    formKey?: string;
}

export interface NavLink {
    text: string;
    active: boolean;
}

export interface HeroData {
    tagline: string;
    headline: string;
    subtext: string;
    buttonText: string;
    bgImage: string;
}

export interface StatData {
    icon: string;
    value: string;
    label: string;
}

export interface ProjectItem {
    title: string;
    location: string;
    image: string;
    class: string;
}

export interface ProjectsSection {
    tag: string;
    title: string;
    buttonText: string;
    items: ProjectItem[];
}

export interface ServiceItem {
    icon: string;
    title: string;
    desc: string;
}

export interface ServicesSection {
    tag: string;
    title: string;
    text: string;
    buttonText: string;
    items: ServiceItem[];
}

export interface ProcessItem {
    number: string;
    title: string;
    desc: string;
    highlight: boolean;
}

export interface ProcessSection {
    tag: string;
    title: string;
    buttonText: string;
    items: ProcessItem[];
}

export interface InsightItem {
    date: string;
    title: string;
    image: string;
}

export interface InsightsSection {
    tag: string;
    title: string;
    buttonText: string;
    items: InsightItem[];
}

export interface ContactData {
    icon: string;
    text: string;
}

export interface SocialData {
    icon: string;
    link: string;
}

export interface FooterData {
    ctaTitle: string;
    ctaButton: string;
    contact: ContactData[];
    social: SocialData[];
    brandText: string;
    copyright: string;
    links: string[];
}

export interface FormField {
    label: string;
    type: string;
}

export interface CustomForm {
    id: string;
    title: string;
    fields: FormField[];
}

export interface SiteData {
    brand: BrandData;
    nav: NavLink[];
    headerAction: string;
    hero: HeroData;
    stats: StatData[];
    projectsSection: ProjectsSection;
    servicesSection: ServicesSection;
    processSection: ProcessSection;
    insightsSection: InsightsSection;
    footer: FooterData;
    forms?: CustomForm[];
}
