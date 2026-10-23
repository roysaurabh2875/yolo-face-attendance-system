
from collections import Counter

from fastapi.routing import APIRoute

from backend.main import app


PUBLIC_ENDPOINTS = {
    ("POST", "/api/auth/login"),
}

# These dependencies establish authentication.
# Ownership and role restrictions also require
# appropriate endpoint-level authorization.
AUTH_DEPENDENCIES = {
    "require_jwt_admin",
    "get_current_user",
    "require_role",
    "authorized_session",
}

SCANNER_PATH = "/scan"


def collect_dependencies(dependant, found=None):
    """
    Recursively inspect FastAPI dependencies,
    including router-level and nested ones.
    """
    if found is None:
        found = set()

    for dependency in dependant.dependencies:
        if dependency.call is not None:
            name = getattr(
                dependency.call,
                "__name__",
                type(dependency.call).__name__,
            )
            found.add(name)

        collect_dependencies(
            dependency,
            found,
        )

    return found


def classify_route(method, path, dependencies):
    if (method, path) in PUBLIC_ENDPOINTS:
        return "PUBLIC (EXPECTED)"

    if SCANNER_PATH in path and (
        path.startswith("/api/sessions/")
    ):
        # The scanner may validate its own key
        # inside the handler rather than through
        # a FastAPI dependency.
        return "SCANNER - MANUAL REVIEW REQUIRED"

    if "require_admin" in dependencies:
        return "LEGACY ADMIN AUTH"

    if "require_jwt_admin" in dependencies:
        return "ADMIN JWT"

    if "require_role" in dependencies:
        return "ROLE JWT - VERIFY PERMITTED ROLES"

    if "authorized_session" in dependencies:
        return "SESSION JWT - VERIFY OWNERSHIP"

    if "get_current_user" in dependencies:
        return "JWT - CHECK AUTHORIZATION"

    return "UNPROTECTED / NEEDS REVIEW"


def main():
    print("=" * 75)
    print("FACE ATTENDANCE - FASTAPI SECURITY AUDIT")
    print("=" * 75)

    counts = Counter()
    findings = []

    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue

        dependencies = collect_dependencies(
            route.dependant
        )

        for method in sorted(route.methods):
            if method in {"HEAD", "OPTIONS"}:
                continue

            classification = classify_route(
                method,
                route.path,
                dependencies,
            )

            counts[classification] += 1

            print()
            print(f"{method:6} {route.path}")
            print(f"       CLASS: {classification}")
            print(
                "       DEPENDENCIES:",
                ", ".join(sorted(dependencies))
                or "NONE",
            )

            if classification in {
                "LEGACY ADMIN AUTH",
                "UNPROTECTED / NEEDS REVIEW",
                "SCANNER - MANUAL REVIEW REQUIRED",
                "JWT - CHECK AUTHORIZATION",
                "ROLE JWT - VERIFY PERMITTED ROLES",
                "SESSION JWT - VERIFY OWNERSHIP",
            }:
                findings.append(
                    (
                        method,
                        route.path,
                        classification,
                    )
                )

    print()
    print("=" * 75)
    print("AUDIT SUMMARY")
    print("=" * 75)

    for classification, count in sorted(
        counts.items()
    ):
        print(f"{classification}: {count}")

    print()
    print("ROUTES REQUIRING FURTHER REVIEW:")
    for method, path, classification in findings:
        print(
            f"  {method} {path} "
            f"=> {classification}"
        )

    if not findings:
        print("No routes flagged by this scanner.")

    print()
    print(
        "NOTE: This is a static dependency audit. "
        "It does not prove that permissions work "
        "correctly or that the API is secure."
    )


if __name__ == "__main__":
    main()
