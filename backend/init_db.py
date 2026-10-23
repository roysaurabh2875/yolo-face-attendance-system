
from sqlalchemy import inspect

from backend.database import Base, engine, test_connection

# Import models so SQLAlchemy registers every table.
import backend.models


def initialize_database():
    print("Checking MySQL connection...")
    test_connection()

    print("Creating missing attendance tables...")
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    tables = inspector.get_table_names()

    print("\nAvailable database tables:")
    for table in sorted(tables):
        print(" -", table)

    print("\nDatabase initialization completed!")


if __name__ == "__main__":
    initialize_database()
