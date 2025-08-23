#!/bin/bash

# Supabase Unified Deployment Script
# Combines email template generation, deployment, and functions deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS] [COMPONENTS]

Unified Supabase deployment script for email templates and functions

Options:
  -e, --env ENV           Environment file to load (required)
  -d, --dry-run           Show what would be deployed without making changes
  -h, --help              Show this help message
  --skip-templates        Skip email template deployment
  --skip-functions        Skip functions deployment
  --templates-only        Deploy only email templates
  --functions-only        Deploy only functions

Components (optional, deploy specific items):
  Email Templates: signup, invite, magiclink, changeemail, resetpassword, reauth
  Functions: missing-waiver-reminder, payment-reminder, sync-pending-payments

Environment Variables (required in env file):
  SUPABASE_ACCESS_TOKEN   Your Supabase access token
  SUPABASE_PROJECT_REF    Your project reference ID
  SUPABASE_URL           Your Supabase project URL (optional, for functions)
  SUPABASE_ANON_KEY      Your Supabase anon key (optional, for functions)

Examples:
  $0 --env .env.production                    # Deploy everything
  $0 --env .env.staging --templates-only      # Deploy only email templates
  $0 --env .env.production --functions-only   # Deploy only functions
  $0 --env .env.production signup invite      # Deploy specific email templates
  $0 --env .env.production payment-reminder   # Deploy specific function
  $0 --dry-run --env .env.production          # Preview deployment

Get your access token from: https://supabase.com/dashboard/account/tokens
Find your project ref in your project URL: https://supabase.com/dashboard/project/[PROJECT_REF]
EOF
}

# Check dependencies
check_dependencies() {
    local missing_deps=()
    
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    if ! command -v supabase &> /dev/null; then
        missing_deps+=("supabase")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        log_info "Install missing dependencies:"
        for dep in "${missing_deps[@]}"; do
            case $dep in
                "curl") echo "  - curl: brew install curl" ;;
                "jq") echo "  - jq: brew install jq" ;;
                "supabase") echo "  - supabase: npm install -g supabase" ;;
            esac
        done
        exit 1
    fi
}

# Load environment file
load_env() {
    local env_file="$1"
    
    if [ ! -f "$env_file" ]; then
        log_error "Environment file not found: $env_file"
        log_info "Create an environment file with:"
        log_info "  SUPABASE_ACCESS_TOKEN=your-token"
        log_info "  SUPABASE_PROJECT_REF=your-project-ref"
        exit 1
    fi
    
    # Load environment variables
    set -a
    source "$env_file"
    set +a
    
    # Validate required variables
    if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
        log_error "SUPABASE_ACCESS_TOKEN is required"
        log_info "Get your token from: https://supabase.com/dashboard/account/tokens"
        exit 1
    fi
    
    if [ -z "$SUPABASE_PROJECT_REF" ]; then
        log_error "SUPABASE_PROJECT_REF is required"
        log_info "Find your project ref in your project URL: https://supabase.com/dashboard/project/[PROJECT_REF]"
        exit 1
    fi
}

# Generate email templates
generate_templates() {
    log_info "Generating email templates..."
    
    # Get script directory reliably
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local email_templates_dir="$script_dir/../supabase/email_templates"
    
    if [ ! -d "$email_templates_dir" ]; then
        log_error "Email templates directory not found: $email_templates_dir"
        exit 1
    fi
    
    cd "$email_templates_dir"
    
    # Generate templates using the generation script
    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY RUN] Would generate email templates"
    else
        chmod +x generate-supabase-template.sh
        ./generate-supabase-template.sh
        log_success "Email templates generated"
    fi
    
    cd - > /dev/null
}

# Deploy email templates using Supabase Management API
deploy_templates() {
    local templates=("$@")
    
    log_info "Deploying email templates..."
    
    # Get script directory reliably
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local email_templates_dir="$script_dir/../supabase/email_templates"
    cd "$email_templates_dir"
    
    # Function to get template file by type
    get_template_file() {
        case "$1" in
            "signup") echo "supabase-signup-email-template.html" ;;
            "invite") echo "supabase-invite-email-template.html" ;;
            "magiclink") echo "supabase-magiclink-email-template.html" ;;
            "changeemail") echo "supabase-changeemail-email-template.html" ;;
            "resetpassword") echo "supabase-resetpassword-email-template.html" ;;
            "reauth") echo "supabase-reauth-email-template.html" ;;
            *) echo "" ;;
        esac
    }
    
    # Deploy specific templates or all if none specified
    local templates_to_deploy=()
    if [ ${#templates[@]} -gt 0 ]; then
        templates_to_deploy=("${templates[@]}")
    else
        templates_to_deploy=("signup" "invite" "magiclink" "changeemail" "resetpassword" "reauth")
    fi
    
    for template_type in "${templates_to_deploy[@]}"; do
        local template_file=$(get_template_file "$template_type")
        
        if [ -z "$template_file" ]; then
            log_warning "Unknown template type: $template_type"
            continue
        fi
        
        if [ ! -f "$template_file" ]; then
            log_warning "Template file not found: $template_file"
            continue
        fi
        
        log_info "Deploying template: $template_type ($template_file)"
        
        if [ "$DRY_RUN" = "true" ]; then
            log_info "[DRY RUN] Would deploy $template_type template"
        else
            # Read template content
            local template_content=$(cat "$template_file")
            
            # Deploy using Supabase Management API
            local response=$(curl -s -w "\n%{http_code}" \
                -X PUT \
                -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
                -H "Content-Type: application/json" \
                "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/config/auth" \
                -d "{
                    \"MAILER_TEMPLATES\": {
                        \"$template_type\": {
                            \"content\": $(echo "$template_content" | jq -Rs .)
                        }
                    }
                }")
            
            local http_code=$(echo "$response" | tail -n1)
            local response_body=$(echo "$response" | head -n -1)
            
            if [ "$http_code" = "200" ]; then
                log_success "Template deployed: $template_type"
            else
                log_error "Failed to deploy $template_type template (HTTP $http_code)"
                log_error "Response: $response_body"
            fi
        fi
    done
    
    log_success "Email template deployment completed"
    cd - > /dev/null
}

# Deploy Supabase functions
deploy_functions() {
    local functions=("$@")
    
    log_info "Deploying Supabase functions..."
    
    local project_root="$(dirname "$0")/.."
    cd "$project_root"
    
    # Check if supabase is linked
    if [ ! -f ".supabase/config.toml" ]; then
        log_warning "Supabase project not linked. Attempting to link..."
        if [ "$DRY_RUN" = "true" ]; then
            log_info "[DRY RUN] Would link Supabase project: $SUPABASE_PROJECT_REF"
        else
            supabase link --project-ref "$SUPABASE_PROJECT_REF"
            log_success "Supabase project linked"
        fi
    fi
    
    if [ ${#functions[@]} -gt 0 ]; then
        # Deploy specific functions
        for func in "${functions[@]}"; do
            log_info "Deploying function: $func"
            if [ "$DRY_RUN" = "true" ]; then
                log_info "[DRY RUN] Would deploy function: $func"
            else
                supabase functions deploy "$func"
                log_success "Function deployed: $func"
            fi
        done
    else
        # Deploy all functions
        if [ "$DRY_RUN" = "true" ]; then
            log_info "[DRY RUN] Would deploy all functions"
        else
            supabase functions deploy
            log_success "All functions deployed"
        fi
    fi
    
    cd - > /dev/null
}

# Main deployment logic
main() {
    local env_file=""
    local dry_run=false
    local skip_templates=false
    local skip_functions=false
    local templates_only=false
    local functions_only=false
    local components=()
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--env)
                env_file="$2"
                shift 2
                ;;
            -d|--dry-run)
                dry_run=true
                shift
                ;;
            --skip-templates)
                skip_templates=true
                shift
                ;;
            --skip-functions)
                skip_functions=true
                shift
                ;;
            --templates-only)
                templates_only=true
                shift
                ;;
            --functions-only)
                functions_only=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            -*)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
            *)
                components+=("$1")
                shift
                ;;
        esac
    done
    
    # Validate arguments
    if [ -z "$env_file" ]; then
        log_error "Environment file is required"
        show_usage
        exit 1
    fi
    
    if [ "$templates_only" = "true" ] && [ "$functions_only" = "true" ]; then
        log_error "Cannot use --templates-only and --functions-only together"
        exit 1
    fi
    
    # Set global dry run flag
    export DRY_RUN="$dry_run"
    
    log_info "Supabase Unified Deployment Tool"
    
    if [ "$dry_run" = "true" ]; then
        log_warning "DRY RUN MODE - No actual changes will be made"
    fi
    
    # Check dependencies and load environment
    check_dependencies
    load_env "$env_file"
    
    # Separate components into templates and functions
    local email_templates=()
    local functions=()
    local template_types=("signup" "invite" "magiclink" "changeemail" "resetpassword" "reauth")
    local function_types=("missing-waiver-reminder" "payment-reminder" "sync-pending-payments")
    
    for component in "${components[@]}"; do
        if [[ " ${template_types[*]} " =~ " $component " ]]; then
            email_templates+=("$component")
        elif [[ " ${function_types[*]} " =~ " $component " ]]; then
            functions+=("$component")
        else
            log_warning "Unknown component: $component"
        fi
    done
    
    # Execute deployment based on options
    if [ "$functions_only" = "true" ]; then
        deploy_functions "${functions[@]}"
    elif [ "$templates_only" = "true" ]; then
        generate_templates
        deploy_templates "${email_templates[@]}"
    else
        # Deploy everything (unless specifically skipped)
        if [ "$skip_templates" = "false" ]; then
            generate_templates
            deploy_templates "${email_templates[@]}"
        fi
        
        if [ "$skip_functions" = "false" ]; then
            deploy_functions "${functions[@]}"
        fi
    fi
    
    log_success "Deployment completed successfully!"
}

# Run main function with all arguments
main "$@"